# # backend/main.py
# import asyncio
# import json
# import os
# from fastapi import FastAPI, Request, HTTPException
# from fastapi.responses import StreamingResponse, HTMLResponse
# from fastapi.staticfiles import StaticFiles
# from fastapi.middleware.cors import CORSMiddleware
# from sse_starlette.sse import EventSourceResponse #pip install sse-starlette==0.10.0
# import uvicorn
# import logging
#
# from explorer import ConceptExplorer
# from models import ExplorationRequest
# from config import GEMINI_API_KEY, OPENAI_API_KEY  # Load keys from .env
#
# # --- Logging Setup ---
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)
#
# # --- FastAPI App Setup ---
# app = FastAPI(title="Concept Explorer API")
#
# # --- CORS Configuration ---
# # Allows the frontend (running on a different port) to communicate with the backend
# origins = [
#     "http://localhost",  # Allow local development
#     "http://localhost:8000",  # Default FastAPI port (if frontend served separately)
#     "http://127.0.0.1",
#     "http://127.0.0.1:8000",
#     "*",
#     # Add the origin where your frontend will be served if different
# ]
#
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
#
# # --- Mount Static Files (for serving frontend directly) ---
# # If you run the frontend separately, this is not strictly needed
# # but it allows serving index.html from the backend root
# script_dir = os.path.dirname(__file__)
# frontend_dir = os.path.abspath(os.path.join(script_dir, '..', 'frontend'))
# if os.path.exists(frontend_dir):
#     app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
# else:
#     logger.warning(f"Frontend directory not found at: {frontend_dir}. Frontend will not be served by FastAPI.")
#
# # --- Global State (Use with caution in production - consider proper state management) ---
# # For simplicity, we store the latest explorer instance here.
# # In a real app, you'd manage state per user/session.
# current_explorer = None
#
#
# # --- SSE Stream Function ---
# async def exploration_streamer(explorer: ConceptExplorer, request_params: ExplorationRequest):
#     """
#     Generator function to stream exploration progress via SSE.
#     Yields JSON updates for the frontend.
#     """
#     global current_explorer
#     current_explorer = explorer  # Store the instance
#
#     try:
#         # Initial state
#         yield json.dumps({"type": "status", "message": "Starting exploration...", "graph": explorer.get_json_tree()})
#         await asyncio.sleep(0.1)  # Give frontend time to process
#
#         queue = [(request_params.root_concept, 0, [])]  # (concept, depth, path)
#         nodes_processed = 0
#
#         while queue:
#             if await request_params.request.is_disconnected():
#                 logger.info("Client disconnected, stopping exploration.")
#                 yield json.dumps({"type": "status", "message": "Client disconnected, stopping exploration."})
#                 break
#
#             concept, depth, path = queue.pop(0)  # Use pop(0) for BFS-like behavior visualization
#
#             if depth >= request_params.depth:
#                 continue
#
#             # --- Update Status ---
#             status_message = f"Exploring: {concept} (Depth: {depth})"
#             logger.info(status_message)
#             yield json.dumps({"type": "status", "message": status_message, "current_concept": concept})
#             await asyncio.sleep(0.1)  # Allow UI update
#
#             # --- Get Related Concepts (API Call) ---
#             try:
#                 related_concepts = await explorer.get_related_concepts_async(concept, depth, path)
#                 nodes_processed += 1
#             except Exception as api_error:
#                 logger.error(f"API Error exploring '{concept}': {api_error}")
#                 yield json.dumps({"type": "error", "message": f"API Error for '{concept}': {str(api_error)}"})
#                 await asyncio.sleep(0.5)  # Pause before potentially continuing
#                 continue  # Skip adding children if API failed for this node
#
#             # --- Add to Graph and Queue ---
#             added_new_node = False
#             if related_concepts:
#                 for rel_concept in related_concepts:
#                     if rel_concept not in explorer.graph:
#                         explorer.graph.add_node(rel_concept)
#                         added_new_node = True
#                     if not explorer.graph.has_edge(concept, rel_concept):
#                         explorer.graph.add_edge(concept, rel_concept)
#                         added_new_node = True  # Edge added counts as update
#
#                     new_path = path + [concept]
#                     # Add to front of queue for better visualization flow if desired,
#                     # or end for strict BFS depth order
#                     queue.append((rel_concept, depth + 1, new_path))
#
#                 # --- Send Graph Update ---
#                 if added_new_node:
#                     graph_data = explorer.get_json_tree()
#                     if graph_data:  # Ensure root exists
#                         yield json.dumps({"type": "graph_update", "graph": graph_data})
#                     await asyncio.sleep(0.2)  # Throttle updates slightly
#
#             # Optional small delay between processing nodes
#             await asyncio.sleep(request_params.sleep_duration)
#
#         # --- Exploration Complete ---
#         logger.info("Exploration complete.")
#         final_graph = explorer.get_json_tree()
#         yield json.dumps({"type": "status", "message": "Exploration complete!", "graph": final_graph})
#         yield json.dumps({"type": "done"})  # Signal completion
#
#     except asyncio.CancelledError:
#         logger.info("Exploration task cancelled.")
#         yield json.dumps({"type": "status", "message": "Exploration cancelled."})
#     except Exception as e:
#         logger.exception("Error during exploration stream:")
#         yield json.dumps({"type": "error", "message": f"An internal error occurred: {str(e)}"})
#     finally:
#         logger.info("Stream finished.")
#
#
# # --- API Endpoints ---
# @app.post("/start_exploration", response_class=HTMLResponse)
# async def start_exploration_endpoint(request: Request, params: ExplorationRequest):
#     """
#     Placeholder endpoint - actual streaming happens via /stream_exploration.
#     This could potentially return an ID for the exploration later.
#     """
#     # Basic validation
#     if params.provider == "gemini" and not GEMINI_API_KEY and not params.api_key:
#         raise HTTPException(status_code=400, detail="Gemini API key not provided in backend environment or request.")
#     if params.provider == "openai" and not OPENAI_API_KEY and not params.api_key:
#         raise HTTPException(status_code=400, detail="OpenAI API key not provided in backend environment or request.")
#
#     # Use provided key if available, otherwise fallback to environment key
#     api_key_to_use = params.api_key or (GEMINI_API_KEY if params.provider == "gemini" else OPENAI_API_KEY)
#
#     if not api_key_to_use:
#         raise HTTPException(status_code=400, detail=f"{params.provider.capitalize()} API key is missing.")
#
#     # In a real app, you might generate a unique ID here and pass it to the streamer
#     # For now, just acknowledge the request. The client will immediately connect to /stream_exploration
#     return HTMLResponse(content="Exploration request received. Connect to /stream_exploration for updates.",
#                         status_code=202)
#
#
# @app.get("/stream_exploration")
# async def stream_exploration_endpoint(
#         request: Request,  # FastAPI injects the request object
#         root_concept: str,
#         model: str,
#         provider: str,
#         depth: int = 3,
#         diversity: float = 0.8,
#         sleep_duration: float = 0.5,
#         api_key: str | None = None  # Allow API key via query param for SSE
# ):
#     """
#     Endpoint to stream exploration progress using Server-Sent Events (SSE).
#     Takes parameters via query string.
#     """
#     logger.info(f"Received stream request for: {root_concept} (Provider: {provider}, Model: {model})")
#
#     # --- Parameter Validation ---
#     if provider not in ["gemini", "openai"]:
#         raise HTTPException(status_code=400, detail="Invalid provider. Choose 'gemini' or 'openai'.")
#
#     api_key_to_use = api_key or (GEMINI_API_KEY if provider == "gemini" else OPENAI_API_KEY)
#
#     if not api_key_to_use:
#         raise HTTPException(status_code=400,
#                             detail=f"{provider.capitalize()} API key is missing (provide via query param 'api_key' or set in backend .env).")
#
#     # --- Create Explorer Instance ---
#     try:
#         explorer = ConceptExplorer(
#             provider=provider,
#             model=model,
#             api_key=api_key_to_use
#         )
#         # Initialize graph with root
#         explorer.graph.add_node(root_concept)
#
#     except Exception as init_error:
#         logger.exception("Failed to initialize ConceptExplorer")
#         raise HTTPException(status_code=500, detail=f"Failed to initialize explorer: {init_error}")
#
#     # --- Create Request Model for Streamer ---
#     # We create this object to pass validated+typed params easily
#     request_params = ExplorationRequest(
#         request=request,  # Pass the raw request for disconnect check
#         root_concept=root_concept,
#         model=model,
#         provider=provider,
#         depth=depth,
#         diversity=diversity,
#         sleep_duration=sleep_duration,
#         api_key=api_key_to_use  # Pass the resolved key
#     )
#
#     # --- Return SSE Response ---
#     return EventSourceResponse(exploration_streamer(explorer, request_params))
#
#
# @app.get("/get_latest_tree")
# async def get_latest_tree_endpoint():
#     """ Returns the JSON representation of the most recently generated tree. """
#     global current_explorer
#     if current_explorer and current_explorer.graph.nodes:
#         return current_explorer.get_json_tree()
#     else:
#         # Return a default structure if no exploration has run yet
#         return {"name": "No Exploration Yet", "children": []}
#
#
# @app.get("/", response_class=HTMLResponse, include_in_schema=False)
# async def read_root():
#     """Serves the main frontend HTML file."""
#     index_path = os.path.join(frontend_dir, 'index.html')
#     if os.path.exists(index_path):
#         with open(index_path, 'r') as f:
#             return HTMLResponse(content=f.read())
#     else:
#         # Fallback message if index.html is not found
#         # This might happen if frontend is served separately
#         return HTMLResponse(content="""
#             <html>
#                 <head><title>Concept Explorer</title></head>
#                 <body>
#                     <h1>Concept Explorer Backend</h1>
#                     <p>Welcome! The backend is running.</p>
#                     <p>If you see this, the frontend (index.html) could not be found.</p>
#                     <p>Ensure the frontend directory is correctly placed relative to the backend
#                        or serve the frontend files using a separate web server.</p>
#                     <p>API documentation available at <a href="/docs">/docs</a>.</p>
#                 </body>
#             </html>
#         """)
#
#
# # --- Main Execution ---
# if __name__ == "__main__":
#     # Use port 8000, standard for FastAPI dev
#     uvicorn.run(app, host="0.0.0.0", port=8000)

# backend/main.py
import asyncio
import json
import os
from typing import Optional, Dict, Any, List, Tuple, Set

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv
import uvicorn
import logging

# Assuming these imports exist based on user's code
from explorer import ConceptExplorer
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

