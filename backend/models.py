# backend/models.py
from pydantic import BaseModel, Field
from fastapi import Request # Import Request for type hinting

class ExplorationRequest(BaseModel):
    # Include the request object itself for checking disconnection in streamer
    request: Request = Field(..., exclude=True) # Exclude from schema/serialization

    root_concept: str = Field(..., min_length=1, description="The starting concept for exploration.")
    model: str = Field(..., description="The specific LLM model name (e.g., 'gemini-1.5-flash', 'gpt-4o-mini').")
    provider: str = Field(..., pattern="^(gemini|openai)$", description="The LLM provider ('gemini' or 'openai').")
    depth: int = Field(default=3, gt=0, le=10, description="Maximum exploration depth.")
    diversity: float = Field(default=0.8, ge=0.0, le=1.0, description="Diversity bias (0.0 to 1.0). Currently not implemented in core logic.")
    sleep_duration: float = Field(default=0.5, ge=0.0, description="Delay between processing nodes (seconds).")
    api_key: str | None = Field(default=None, description="API key for the provider (optional if set in backend .env).")

    # Allow request object to be passed without validation errors
    class Config:
        arbitrary_types_allowed = True
