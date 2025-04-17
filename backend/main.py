
# backend/main.py
from .explorer import ConceptExplorer
import asyncio
import json
import os
from typing import Optional, Dict, Any, List, Tuple, Set

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse #pip install sse-starlette==0.10.0
from dotenv import load_dotenv
import uvicorn
import logging

# Assuming these imports exist based on user's code
# from explorer import ConceptExplorer
from models import ExplorationRequest # Keep if used elsewhere, but not needed for GET endpoint params

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Environment/Config Setup ---
# Load .env file FIRST, before potentially importing other modules that might need env vars
# Ensure your .env file is in the same directory you run uvicorn from (e.g., backend/)
load_dotenv()
logger.info(".env file loaded (if found).")

# --- Configuration ---
# Define defaults here
# DEFAULT_GEMINI_MODEL = "gemini-1.5-flash-latest"
DEFAULT_GEMINI_MODEL = "gemini-1.5-flash-8b" # Or use the user-specified one if preferred
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

# *** REMOVED Import from config.py - We will use os.getenv directly ***
# from config import GEMINI_API_KEY, OPENAI_API_KEY

# --- FastAPI App Setup ---
app = FastAPI(title="Concept Explorer API")

# --- CORS Configuration ---
origins = ["*"] # Simplified for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Mount Static Files ---
script_dir = os.path.dirname(__file__)
frontend_dir = os.path.abspath(os.path.join(script_dir, '..', 'frontend'))
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
    logger.info(f"Serving static files from: {frontend_dir}")
else:
    logger.warning(f"Frontend directory not found at: {frontend_dir}. Frontend will not be served by FastAPI.")

# --- Global State (Use with caution) ---
current_explorer: Optional[ConceptExplorer] = None


# --- SSE Stream Function ---
# (Using the user's provided streamer logic structure - assuming it works)
async def exploration_streamer(explorer: ConceptExplorer, request_params: Dict[str, Any]):
    global current_explorer
    current_explorer = explorer
    root_concept = request_params['root_concept']
    depth_limit = request_params['depth']
    sleep_duration = request_params['sleep_duration']
    try:
        yield json.dumps({"type": "status", "message": "Starting exploration...", "graph": explorer.get_json_tree()})
        await asyncio.sleep(0.1)
        queue = [(root_concept, 0, [])]
        nodes_processed = 0
        while queue:
            concept, current_depth, path = queue.pop(0)
            if current_depth >= depth_limit: continue
            status_message = f"Exploring: {concept} (Depth: {current_depth})"
            logger.info(status_message)
            yield json.dumps({"type": "status", "message": status_message, "current_concept": concept})
            await asyncio.sleep(0.1)
            try:
                related_concepts = await explorer.get_related_concepts_async(concept=concept, depth=current_depth, path=path)
                nodes_processed += 1
            except Exception as api_error:
                logger.error(f"API Error exploring '{concept}': {api_error}")
                yield json.dumps({"type": "error", "message": f"API Error for '{concept}': {str(api_error)}"})
                await asyncio.sleep(0.5); continue
            added_new_node = False
            if related_concepts:
                for rel_concept in related_concepts:
                    if rel_concept not in explorer.graph: explorer.graph.add_node(rel_concept); added_new_node = True
                    if not explorer.graph.has_edge(concept, rel_concept): explorer.graph.add_edge(concept, rel_concept); added_new_node = True
                    new_path = path + [concept]; queue.append((rel_concept, current_depth + 1, new_path))
                if added_new_node:
                    graph_data = explorer.get_json_tree();
                    if graph_data: yield json.dumps({"type": "graph_update", "graph": graph_data})
                    await asyncio.sleep(0.2)
            await asyncio.sleep(sleep_duration)
        logger.info("Exploration complete.")
        final_graph = explorer.get_json_tree()
        yield json.dumps({"type": "status", "message": "Exploration complete!", "graph": final_graph})
        yield json.dumps({"type": "done", "graph": final_graph})
    except asyncio.CancelledError: logger.info("Exploration task cancelled."); yield json.dumps({"type": "status", "message": "Exploration cancelled."})
    except Exception as e: logger.exception("Error during exploration stream:"); yield json.dumps({"type": "error", "message": f"An internal error occurred: {str(e)}"})
    finally: logger.info("Stream finished.")


# --- API Endpoints ---
@app.get("/stream_exploration")
async def stream_exploration_endpoint(
        request: Request,
        root_concept: str,
        provider: str,
        depth: int = Query(3, ge=1, le=8),
        sleep_duration: float = Query(0.2, ge=0, le=5),
        diversity: float = Query(0.8, ge=0, le=1),
        model: Optional[str] = Query(None),
        api_key: Optional[str] = Query(None)
):
    logger.info(f"Received stream request for: '{root_concept}' (Provider: {provider})")

    # --- Determine Model and API Key ---
    final_model = model
    final_api_key = api_key

    # *** MODIFIED: Use os.getenv directly ***
    if provider == 'gemini':
        if not final_model:
            final_model = DEFAULT_GEMINI_MODEL
            logger.info(f"No model provided, using default Gemini model: {final_model}")
        if not final_api_key:
            # Read directly from environment AFTER load_dotenv() has run
            final_api_key = os.getenv("GEMINI_API_KEY")
            if final_api_key:
                 logger.info("Using GEMINI_API_KEY from backend environment.")
            else:
                 logger.error("GEMINI_API_KEY missing from request and environment.")
                 raise HTTPException(status_code=400, detail="GEMINI_API_KEY not provided and not found in backend environment.")

    elif provider == 'openai':
        if not final_model:
            final_model = DEFAULT_OPENAI_MODEL
            logger.info(f"No model provided, using default OpenAI model: {final_model}")
        if not final_api_key:
             # Read directly from environment
            final_api_key = os.getenv("OPENAI_API_KEY")
            if final_api_key:
                 logger.info("Using OPENAI_API_KEY from backend environment.")
            else:
                 logger.error("OPENAI_API_KEY missing from request and environment.")
                 raise HTTPException(status_code=400, detail="OPENAI_API_KEY not provided and not found in backend environment.")
    else:
        logger.error(f"Invalid provider received: {provider}")
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    logger.info(f"Using Model: {final_model}")
    logger.info(f"API Key Provided: {'Yes (in request)' if api_key else ('Yes (from env)' if final_api_key and not api_key else 'No')}")


    # --- Create Explorer Instance ---
    try:
        explorer = ConceptExplorer( provider=provider, model=final_model, api_key=final_api_key )
        if root_concept not in explorer.graph: explorer.graph.add_node(root_concept)
    except Exception as init_error:
        logger.exception("Failed to initialize ConceptExplorer")
        raise HTTPException(status_code=500, detail=f"Failed to initialize explorer: {init_error}")

    # --- Prepare parameters for the streamer ---
    streamer_params = { "root_concept": root_concept, "depth": depth, "sleep_duration": sleep_duration, "diversity": diversity, "provider": provider, "model": final_model, "api_key": final_api_key, }

    # --- Return SSE Response using sse-starlette ---
    return EventSourceResponse(exploration_streamer(explorer, streamer_params))


@app.get("/get_latest_tree")
async def get_latest_tree_endpoint():
    global current_explorer
    if current_explorer and current_explorer.graph.nodes: logger.info("Returning latest generated tree."); return current_explorer.get_json_tree()
    else: logger.info("No exploration has run yet or graph is empty."); return {"name": "No Exploration Yet", "children": []}


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def read_root():
    index_path = os.path.join(frontend_dir, 'index.html')
    if os.path.exists(index_path): return FileResponse(index_path)
    else: logger.warning(f"index.html not found at {index_path}. Serving fallback HTML."); return HTMLResponse(content="<html><body><h1>Concept Explorer Backend</h1><p>index.html not found.</p></body></html>")


@app.get("/health", include_in_schema=False)
async def health_check(): return {"status": "ok"}

