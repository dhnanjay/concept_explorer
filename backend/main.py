# backend/main.py
import asyncio
import json
import os
import logging
from typing import Optional, Dict, Any

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse  # pip install sse-starlette==0.10.0
from dotenv import load_dotenv
import uvicorn

from tavily import AsyncTavilyClient
from .explorer import ConceptExplorer
from .models import ExplorationRequest

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Environment / Config ---
load_dotenv()  # reads .env in this folder, if present
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY")
TAVILY_API_KEY   = os.getenv("TAVILY_API_KEY")

if not TAVILY_API_KEY:
    logger.error("TAVILY_API_KEY not found in environment")
    raise RuntimeError("TAVILY_API_KEY is required")

# instantiate once
tavily_client = AsyncTavilyClient(TAVILY_API_KEY)

DEFAULT_GEMINI_MODEL = "gemini-1.5-flash-8b"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

# --- FastAPI Setup ---
app = FastAPI(title="Concept Explorer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mount the frontend/static
script_dir = os.path.dirname(__file__)
frontend_dir = os.path.abspath(os.path.join(script_dir, "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
    logger.info(f"Serving static from {frontend_dir}")
else:
    logger.warning("frontend directory not found; skipping static mount")

current_explorer: Optional[ConceptExplorer] = None


# --- SSE streamer for concept exploration (unchanged) ---
async def exploration_streamer(explorer: ConceptExplorer, params: Dict[str, Any]):
    global current_explorer
    current_explorer = explorer
    root, depth, sleep = params["root_concept"], params["depth"], params["sleep_duration"]

    yield json.dumps({"type": "status", "message": "Starting exploration...", "graph": explorer.get_json_tree()})
    await asyncio.sleep(0.1)

    queue = [(root, 0, [])]
    while queue:
        concept, d, path = queue.pop(0)
        if d >= depth:
            continue

        yield json.dumps({"type": "status", "message": f"Exploring: {concept} (Depth {d})", "current_concept": concept})
        await asyncio.sleep(0.1)

        try:
            related = await explorer.get_related_concepts_async(concept=concept, depth=d, path=path)
        except Exception as err:
            logger.error(f"API error on {concept}: {err}")
            yield json.dumps({"type": "error", "message": str(err)})
            await asyncio.sleep(0.5)
            continue

        for rc in related:
            if rc not in explorer.graph:
                explorer.graph.add_node(rc)
            if not explorer.graph.has_edge(concept, rc):
                explorer.graph.add_edge(concept, rc)
            queue.append((rc, d + 1, path + [concept]))

        # push graph update
        tree = explorer.get_json_tree()
        if tree:
            yield json.dumps({"type": "graph_update", "graph": tree})
        await asyncio.sleep(sleep)

    final = explorer.get_json_tree()
    yield json.dumps({"type": "status", "message": "Exploration complete!", "graph": final})
    yield json.dumps({"type": "done", "graph": final})


# --- Endpoints ---

@app.get("/stream_exploration")
async def stream_exploration(
    request: Request,
    root_concept: str,
    provider: str,
    depth: int = Query(3, ge=1, le=8),
    sleep_duration: float = Query(0.2, ge=0, le=5),
    diversity: float = Query(0.8, ge=0, le=1),
    model: Optional[str] = Query(None),
    api_key: Optional[str] = Query(None),
):
    logger.info(f"Stream request: {root_concept} via {provider}")

    # choose model & key
    final_model = model or (DEFAULT_GEMINI_MODEL if provider=="gemini" else DEFAULT_OPENAI_MODEL)
    final_key   = api_key or (GEMINI_API_KEY   if provider=="gemini" else OPENAI_API_KEY)

    if not final_key:
        raise HTTPException(400, f"{provider.upper()} key missing")

    # init explorer
    try:
        explorer = ConceptExplorer(provider=provider, model=final_model, api_key=final_key)
        if root_concept not in explorer.graph:
            explorer.graph.add_node(root_concept)
    except Exception as e:
        logger.exception("Explorer init failed")
        raise HTTPException(500, str(e))

    params = {
        "root_concept": root_concept,
        "depth": depth,
        "sleep_duration": sleep_duration,
        "diversity": diversity,
    }
    return EventSourceResponse(exploration_streamer(explorer, params))


@app.get("/get_latest_tree")
async def get_latest_tree():
    if current_explorer and current_explorer.graph.nodes:
        return current_explorer.get_json_tree()
    return {"name": "No Exploration Yet", "children": []}


@app.get("/search")
async def tavily_search(
    q: str = Query(..., description="Search query (node + path)"),
    search_depth: str = Query("basic", regex="^(basic|advanced)$"),
    topic: str = Query("general", regex="^(general|news)$"),
    max_results: int = Query(5, ge=1, le=20),
):
    """
    Search Tavily for `q`, returning up to `max_results` items,
    including images and LLM‐generated answer.
    """
    try:
        resp = await tavily_client.search(
            query=q,
            search_depth=search_depth,
            topic=topic,
            max_results=max_results,
            include_images=True,
            include_image_descriptions=True,
            include_answer="basic",
        )
        # tavily returns a pydantic model: .dict() → raw JSON
        return resp #resp.dict()
    except Exception as e:
        logger.exception("Tavily search failed")
        raise HTTPException(500, detail=str(e))


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def serve_frontend():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>Concept Explorer Backend</h1><p>No index.html found.</p>")


@app.get("/health", include_in_schema=False)
async def health_check():
    return {"status": "ok"}


# --- Main entrypoint (if run directly) ---
if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)