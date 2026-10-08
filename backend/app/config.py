import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
DEFAULT_DB_PATH = str(Path(__file__).resolve().parents[2] / "database" / "app.db")
DB_PATH = os.getenv("DB_PATH", DEFAULT_DB_PATH)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
