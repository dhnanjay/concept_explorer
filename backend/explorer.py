# backend/explorer.py
import asyncio
import json
import textwrap
import random
import logging
import time

import networkx as nx
import google.generativeai as genai #pip install -q -U google-generativeai
from openai import OpenAI, AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

# --- Logging ---
logger = logging.getLogger(__name__)

# --- Constants ---
DEFAULT_GEMINI_MODEL = "gemini-1.5-flash-latest"  # Or another suitable model
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"  # Or gpt-3.5-turbo, gpt-4 etc.
MAX_API_RETRIES = 3


class ConceptExplorer:
    def __init__(self, provider: str, model: str, api_key: str):
        self.graph = nx.DiGraph()
        self.seen_concepts = set()  # Keep track of concepts sent to API
        self.provider = provider.lower()
        self.model_name = model
        self.api_key = api_key
        self.openai_client = None
        self.gemini_model = None

        if not self.api_key:
            raise ValueError(f"{self.provider.capitalize()} API key is required.")

        try:
            if self.provider == "openai":
                # Use Async client for async API calls
                self.openai_client = AsyncOpenAI(api_key=self.api_key)
                if not self.model_name: self.model_name = DEFAULT_OPENAI_MODEL
                logger.info(f"Using OpenAI model: {self.model_name}")
            elif self.provider == "gemini":
                genai.configure(api_key=self.api_key)
                if not self.model_name: self.model_name = DEFAULT_GEMINI_MODEL
                # Check if model exists (basic check)
                try:
                    # Note: Listing models might require specific permissions
                    # This is a basic check assuming the model name is valid
                    self.gemini_model = genai.GenerativeModel(self.model_name)
                    logger.info(f"Using Gemini model: {self.model_name}")
                except Exception as e:
                    logger.error(f"Error initializing Gemini model '{self.model_name}': {e}")
                    # Fallback or raise error? For now, log and proceed.
                    # Consider adding a check during API call instead.
                    # raise ValueError(f"Could not initialize Gemini model '{self.model_name}'. Ensure it's available.") from e
            else:
                raise ValueError(f"Unsupported provider: {provider}. Choose 'openai' or 'gemini'.")
        except Exception as e:
            logger.exception(f"Failed to initialize API client for {self.provider}")
            raise ConnectionError(f"Failed to initialize API client for {self.provider}: {e}") from e

    def _build_prompt(self, concept: str, path: list[str]) -> str:
        """Builds the prompt for the LLM API call."""
        full_path = (path or []) + [concept]
        # Using the refined prompt from the user
        prompt = textwrap.dedent(f"""
            Starting with the topic: "{concept}", identify 4-5 key related concepts crucial for learning and understanding this topic, considering the user's current learning path.

            Context: We are building a structured learning path:
            {' → '.join(full_path)}

            Guidelines:
            1. Adapt your suggestions to the specific domain of the topic (e.g., technology, finance, philosophy, science) and the user's implied need for understanding.
            2. Prioritize concepts that are foundational, essential, or highly relevant for building a solid understanding of "{concept}" within its domain.
            3. Express each concept concisely (ideally 1-5 words).
            4. Focus on connections that reveal structure, function, application, comparison/contrast, or underlying principles relevant to "{concept}". Avoid overly simplistic or tangential associations unless they are critical building blocks.
            5. Ensure suggestions logically relate to BOTH:
               - The immediate topic "{concept}"
               - The overall learning path context: {' → '.join(full_path)}
            6. Use the following analytical approaches to identify relevant related concepts for learning:
               - Identify Core Components/Building Blocks: What are the essential parts or prerequisites of "{concept}"?
               - Find Foundational Principles: What underlying theories, rules, or axioms does "{concept}" rely on?
               - Explore Key Processes/Functions: What does "{concept}" *do* or enable? What are the main activities involved?
               - Examine Contrasting/Comparative Concepts: What are important alternatives, opposing ideas, or similar-but-different concepts that clarify "{concept}"?
               - Investigate Practical Applications/Use Cases: Where or how is "{concept}" used in practice?
               - Consider Historical/Evolutionary Context: How did "{concept}" develop or what did it evolve from (if relevant for understanding)?
            7. **IMPORTANT**: Your response MUST be ONLY a valid JSON array of strings, with no other text, explanation, or formatting.

            Avoid suggesting concepts already present in the path: {' → '.join(full_path)}. Strive for relevance and utility for learning.

            Return ONLY a JSON array of strings.
            Example: ["Core Component A", "Underlying Principle B", "Key Process C", "Contrasting Concept D"]
        """).strip()
        return prompt

    @retry(stop=stop_after_attempt(MAX_API_RETRIES), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_openai_api(self, prompt: str) -> str:
        """Calls the OpenAI API asynchronously with retries."""
        if not self.openai_client:
            raise ConnectionError("OpenAI client not initialized.")
        logger.info(f"Calling OpenAI API (model: {self.model_name})...")
        try:
            response = await self.openai_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},  # Request JSON output if model supports
                temperature=0.5,  # Adjust creativity/focus
            )
            content = response.choices[0].message.content
            logger.debug(f"OpenAI Raw Response: {content}")
            if not content:
                logger.warning("OpenAI returned empty content.")
                return "[]"  # Return empty JSON array on empty response
            # Attempt to find JSON within the response, as models might still add markdown/text
            try:
                # Find the start and end of the JSON array
                start = content.find('[')
                end = content.rfind(']')
                if start != -1 and end != -1 and end > start:
                    json_str = content[start:end + 1]
                    # Validate if it's actually JSON
                    json.loads(json_str)
                    return json_str
                else:
                    logger.warning(f"Could not extract JSON array from OpenAI response: {content}")
                    return "[]"
            except json.JSONDecodeError:
                logger.warning(f"OpenAI response was not valid JSON: {content}")
                return "[]"  # Return empty if parsing fails

        except Exception as e:
            logger.exception(f"Error calling OpenAI API: {e}")
            raise  # Re-raise exception to trigger tenacity retry

    @retry(stop=stop_after_attempt(MAX_API_RETRIES), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _call_gemini_api(self, prompt: str) -> str:
        """Calls the Gemini API asynchronously with retries."""
        if not self.gemini_model:
            # Re-check model initialization here if needed
            try:
                self.gemini_model = genai.GenerativeModel(self.model_name)
            except Exception as e:
                raise ConnectionError(f"Gemini model '{self.model_name}' could not be initialized: {e}")

        logger.info(f"Calling Gemini API (model: {self.model_name})...")
        try:
            # Gemini API uses generate_content_async
            response = await self.gemini_model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    # candidate_count=1, # Default is 1
                    # stop_sequences=['...'], # Optional stop sequences
                    # max_output_tokens=...,
                    temperature=0.5,  # Adjust creativity/focus
                    response_mime_type="application/json"  # Request JSON output
                )
            )
            # Handle potential safety blocks or empty responses
            if not response.candidates:
                logger.warning(
                    f"Gemini API returned no candidates. Prompt: '{prompt[:100]}...' Safety Ratings: {response.prompt_feedback}")
                return "[]"

            content = response.text  # Access text directly
            logger.debug(f"Gemini Raw Response: {content}")

            # Gemini with JSON mime type should return clean JSON, but add fallback parsing
            try:
                # Validate it's JSON
                json.loads(content)
                return content
            except json.JSONDecodeError:
                logger.warning(f"Gemini response was not valid JSON despite mime type request: {content}")
                # Attempt to extract JSON like in OpenAI fallback
                start = content.find('[')
                end = content.rfind(']')
                if start != -1 and end != -1 and end > start:
                    json_str = content[start:end + 1]
                    try:
                        json.loads(json_str)
                        return json_str
                    except json.JSONDecodeError:
                        logger.warning(f"Could not extract valid JSON from Gemini response: {content}")
                        return "[]"
                else:
                    logger.warning(f"Could not find JSON array in Gemini response: {content}")
                    return "[]"

        except Exception as e:
            # Catch specific Gemini exceptions if needed, e.g., BlockedPromptError
            # from google.generativeai.types import BlockedPromptError
            # if isinstance(e, BlockedPromptError):
            #     logger.error(f"Gemini API call blocked due to safety settings. Prompt: '{prompt[:100]}...'")
            # else:
            #     logger.exception(f"Error calling Gemini API: {e}")
            logger.exception(f"Error calling Gemini API: {e}")
            raise  # Re-raise exception to trigger tenacity retry

    async def get_related_concepts_async(self, concept: str, depth: int, path: list[str]) -> list[str]:
        """
        Asynchronously query the selected LLM for related concepts.
        Returns a filtered list of unique, concise related concept strings.
        """
        # Avoid re-querying the same concept unnecessarily in this session
        # Note: This doesn't prevent cycles if the LLM suggests an ancestor
        if concept in self.seen_concepts:
            logger.info(f"Concept '{concept}' already queried, skipping API call.")
            return []  # Return empty list if already processed

        self.seen_concepts.add(concept)
        prompt = self._build_prompt(concept, path)

        try:
            if self.provider == "openai":
                response_text = await self._call_openai_api(prompt)
            elif self.provider == "gemini":
                response_text = await self._call_gemini_api(prompt)
            else:
                # Should not happen due to init check, but safeguard
                raise ValueError(f"Invalid provider configured: {self.provider}")

            # --- Process Response ---
            if not response_text:
                logger.warning(f"Received empty response for concept '{concept}'.")
                return []

            try:
                related_concepts = json.loads(response_text)
                if not isinstance(related_concepts, list):
                    logger.warning(f"API response for '{concept}' was not a JSON list: {related_concepts}")
                    return []

                # --- Filter and Clean Concepts ---
                filtered_concepts = []
                current_graph_nodes_lower = {n.lower() for n in self.graph.nodes()}
                path_lower = {p.lower() for p in path + [concept]}

                for rc in related_concepts:
                    if not isinstance(rc, str) or not rc.strip():
                        continue  # Skip non-strings or empty strings

                    rc_clean = rc.strip()
                    # Basic length check (can be adjusted)
                    if len(rc_clean) > 100:
                        rc_clean = rc_clean[:97] + "..."
                        logger.debug(f"Truncated long concept: {rc} -> {rc_clean}")

                    # Avoid adding duplicates already in the graph or the direct path
                    if rc_clean.lower() in current_graph_nodes_lower or rc_clean.lower() in path_lower:
                        logger.debug(f"Rejected duplicate/path concept: {rc_clean}")
                        continue

                    filtered_concepts.append(rc_clean)

                logger.info(f"Found {len(filtered_concepts)} new related concepts for '{concept}'.")
                return filtered_concepts

            except json.JSONDecodeError:
                logger.error(f"Failed to decode JSON response for concept '{concept}': {response_text}")
                return []
            except Exception as e:
                logger.exception(f"Error processing concepts for '{concept}': {e}")
                return []

        except Exception as e:
            # Log errors from API calls (after retries)
            logger.error(f"API call failed for concept '{concept}' after retries: {e}")
            raise  # Propagate the error so the streamer can report it

    def get_json_tree(self) -> dict | None:
        """Export the concept graph as a nested JSON structure for ECharts."""
        roots = [n for n in self.graph.nodes if self.graph.in_degree(n) == 0]
        if not roots:
            logger.warning("No root node found in the graph for JSON export.")
            return None  # Return None if graph is empty or has no root

        # Find the first root (assuming single root for simplicity)
        root_node = roots[0]

        def build_node(node):
            children = list(self.graph.successors(node))
            # Structure required by ECharts: { name: "...", children: [...] }
            node_data = {"name": node}
            if children:
                node_data["children"] = [build_node(child) for child in children]
            # Add other attributes if needed (e.g., value, itemStyle)
            # node_data["value"] = self.graph.nodes[node].get("some_value", 1)
            return node_data

        try:
            tree_data = build_node(root_node)
            # ECharts expects the data to be wrapped in a list
            return tree_data  # Return the single root node structure
        except Exception as e:
            logger.exception(f"Error building JSON tree from graph: {e}")
            return {"name": "Error Building Tree", "children": []}  # Return error node
