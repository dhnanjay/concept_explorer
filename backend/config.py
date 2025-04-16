# backend/config.py
import os
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

# Load environment variables from .env file
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(dotenv_path):
    logger.info("Loading environment variables from .env file.")
    load_dotenv(dotenv_path=dotenv_path)
else:
    logger.warning(".env file not found. API keys should be set as environment variables.")

# GEMINI_API_KEY = os.getenv("")
# OPENAI_API_KEY = os.getenv("")

# Basic check if keys are loaded (optional)
# if not GEMINI_API_KEY:
#     logger.warning("GEMINI_API_KEY environment variable not set.")
# if not OPENAI_API_KEY:
#     logger.warning("OPENAI_API_KEY environment variable not set.")

