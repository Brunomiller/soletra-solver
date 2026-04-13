from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import unicodedata
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Dictionary loading ---
DICTIONARY: List[str] = []

def strip_accents(s: str) -> str:
    """Remove accents from a string, e.g. 'ação' -> 'acao'."""
    nfkd = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))

def load_dictionary():
    global DICTIONARY
    dict_path = ROOT_DIR / 'br-utf8.txt'
    if not dict_path.exists():
        logger.error("Dictionary file not found at %s", dict_path)
        return
    with open(dict_path, 'r', encoding='utf-8') as f:
        words = [line.strip() for line in f if line.strip()]
    # Filter: at least 4 chars, only alpha
    DICTIONARY = [w for w in words if len(w) >= 4 and w.isalpha()]
    logger.info("Dictionary loaded: %d words (4+ letters)", len(DICTIONARY))

load_dictionary()

# --- Models ---
class SolveRequest(BaseModel):
    center_letter: str = Field(..., min_length=1, max_length=1)
    outer_letters: List[str] = Field(..., min_length=6, max_length=6)

class WordResult(BaseModel):
    word: str
    is_pangram: bool

class SolveResponse(BaseModel):
    total: int
    pangram_count: int
    groups: Dict[int, List[WordResult]]

# --- Solve endpoint ---
@api_router.post("/solve", response_model=SolveResponse)
async def solve(req: SolveRequest):
    center = strip_accents(req.center_letter.lower())
    allowed = set(strip_accents(c.lower()) for c in req.outer_letters)
    allowed.add(center)
    all_seven = set(allowed)  # all 7 unique letters

    results: Dict[int, List[WordResult]] = {}
    pangram_count = 0

    for word in DICTIONARY:
        normalized = strip_accents(word.lower())
        # Must contain center letter
        if center not in normalized:
            continue
        # All characters must be in the allowed set
        if not all(c in allowed for c in normalized):
            continue
        # Check pangram
        is_pangram = all_seven.issubset(set(normalized))
        if is_pangram:
            pangram_count += 1

        length = len(normalized)
        if length not in results:
            results[length] = []
        results[length].append(WordResult(word=word.upper(), is_pangram=is_pangram))

    # Sort groups by key, sort words alphabetically within groups
    sorted_groups = {}
    for k in sorted(results.keys()):
        sorted_groups[k] = sorted(results[k], key=lambda w: strip_accents(w.word.lower()))

    total = sum(len(v) for v in sorted_groups.values())

    return SolveResponse(total=total, pangram_count=pangram_count, groups=sorted_groups)

@api_router.get("/")
async def root():
    return {"message": "Soletra Solver API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
