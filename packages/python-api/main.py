"""
Chess Engine — Python API Gateway
=================================
A FastAPI layer that exposes the chess engine over HTTP. It proxies move
execution and evaluation requests to the Node.js engine server.
"""

from __future__ import annotations

import os
import time
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

# ── Configuration ─────────────────────────────────────────────────────────────

ENGINE_URL = os.getenv("ENGINE_URL", "http://engine:3000")
API_VERSION = "1.0.0"

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Chess Motor API",
    description=(
        "REST API for the Chess Motor engine. "
        "Exposes move validation, best-move search, and position evaluation "
        "with full OpenAPI documentation.\n\n"
        "**Source:** https://github.com/jamartbr/chess_motor"
    ),
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared HTTP client (connection-pooled) ────────────────────────────────────

http_client = httpx.AsyncClient(base_url=ENGINE_URL, timeout=10.0)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class GameMode(str):
    pass


class MoveRequest(BaseModel):
    """Apply a move to a position described by FEN."""

    fen: str = Field(
        ...,
        description="FEN string of the position before the move.",
        examples=["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    )
    from_square: str = Field(
        ...,
        alias="from",
        description="Origin square in algebraic notation (e.g. 'e2').",
        examples=["e2"],
    )
    to_square: str = Field(
        ...,
        alias="to",
        description="Destination square in algebraic notation (e.g. 'e4').",
        examples=["e4"],
    )
    promotion: Literal["queen", "rook", "bishop", "knight"] | None = Field(
        default=None,
        description="Promotion piece type. Required when a pawn reaches the back rank.",
    )

    model_config = {"populate_by_name": True}

    @field_validator("from_square", "to_square")
    @classmethod
    def validate_square(cls, v: str) -> str:
        if len(v) != 2 or v[0] not in "abcdefgh" or v[1] not in "12345678":
            raise ValueError(f"Invalid square: '{v}'. Must be algebraic (a1–h8).")
        return v.lower()


class MoveResponse(BaseModel):
    fen: str = Field(..., description="FEN of the position after the move.")
    san: str = Field(..., description="Move in Standard Algebraic Notation.")
    is_check: bool = Field(..., description="True if the move delivers check.")
    is_checkmate: bool = Field(..., description="True if the move delivers checkmate.")
    is_game_over: bool = Field(..., description="True if the game ended after this move.")
    winner: Literal["white", "black", "draw"] | None = Field(
        default=None,
        description="Winner if the game is over, otherwise null.",
    )


class BestMoveRequest(BaseModel):
    fen: str = Field(
        ...,
        description="FEN string of the position to analyse.",
        examples=["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"],
    )
    depth: int = Field(
        default=4,
        ge=1,
        le=8,
        description="Search depth in half-moves (plies). Higher = stronger but slower.",
    )
    mode: Literal["classical", "dominion", "analysis"] = Field(
        default="classical",
        description="Game mode — affects evaluation heuristics.",
    )


class BestMoveResponse(BaseModel):
    from_square: str = Field(..., alias="from", description="Best move origin square.")
    to_square: str = Field(..., alias="to", description="Best move destination square.")
    promotion: str | None = Field(default=None)
    score: float = Field(..., description="Centipawn evaluation from the moving side's perspective.")
    depth: int = Field(..., description="Actual search depth reached.")
    nodes: int = Field(..., description="Nodes evaluated during search.")
    time_ms: int = Field(..., description="Search time in milliseconds.")

    model_config = {"populate_by_name": True}


class EvaluationRequest(BaseModel):
    fen: str = Field(
        ...,
        description="FEN string of the position to evaluate.",
        examples=["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"],
    )
    mode: Literal["classical", "dominion", "analysis"] = Field(default="classical")


class EvaluationResponse(BaseModel):
    score: float = Field(
        ...,
        description=(
            "Centipawn evaluation from White's perspective. "
            "Positive = White is better, negative = Black is better."
        ),
    )
    phase: Literal["opening", "middlegame", "endgame"] = Field(
        ..., description="Detected game phase."
    )
    material_balance: float = Field(
        ..., description="Raw material difference in centipawns (White minus Black)."
    )
    is_check: bool
    is_checkmate: bool
    is_stalemate: bool
    legal_move_count: int = Field(..., description="Number of legal moves for the side to move.")


class LegalMovesRequest(BaseModel):
    fen: str = Field(..., description="FEN of the position.")
    square: str = Field(
        ...,
        description="Square whose legal moves to return (e.g. 'e2').",
        examples=["e2"],
    )

    @field_validator("square")
    @classmethod
    def validate_square(cls, v: str) -> str:
        if len(v) != 2 or v[0] not in "abcdefgh" or v[1] not in "12345678":
            raise ValueError(f"Invalid square: '{v}'.")
        return v.lower()


class LegalMovesResponse(BaseModel):
    square: str
    moves: list[str] = Field(..., description="List of legal destination squares.")
    count: int


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    engine_reachable: bool
    latency_ms: float | None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def proxy(method: str, path: str, **kwargs) -> dict:
    """
    Forward a request to the Node engine server.
    Raises HTTPException with a clean message on any failure.
    """
    try:
        resp = await getattr(http_client, method)(path, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=e.response.json().get("error", str(e)),
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Engine server unreachable: {e}",
        )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    tags=["meta"],
)
async def health() -> HealthResponse:
    """Returns API status and whether the backing engine server is reachable."""
    start = time.monotonic()
    try:
        await http_client.get("/health", timeout=2.0)
        reachable = True
        latency = round((time.monotonic() - start) * 1000, 2)
    except Exception:
        reachable = False
        latency = None

    return HealthResponse(
        status="ok" if reachable else "degraded",
        version=API_VERSION,
        engine_reachable=reachable,
        latency_ms=latency,
    )


@app.post(
    "/api/v1/move",
    response_model=MoveResponse,
    summary="Apply a move",
    tags=["engine"],
    responses={
        400: {"description": "Illegal move or invalid FEN."},
        503: {"description": "Engine server unreachable."},
    },
)
async def apply_move(body: MoveRequest) -> MoveResponse:
    """
    Apply a move to a position.

    Validates the move against the engine's legal-move generator and returns
    the resulting position as FEN along with SAN notation and game-state flags.
    """
    data = await proxy("post", "/move", json=body.model_dump(by_alias=True))
    return MoveResponse(**data)


@app.post(
    "/api/v1/best-move",
    response_model=BestMoveResponse,
    summary="Find the best move",
    tags=["engine"],
    responses={
        400: {"description": "Invalid FEN or parameters."},
        503: {"description": "Engine server unreachable."},
    },
)
async def best_move(body: BestMoveRequest) -> BestMoveResponse:
    """
    Search for the best move in a position using minimax with alpha-beta pruning.

    The `depth` parameter controls the search depth (1–8 plies). Higher depths
    produce stronger moves but increase latency exponentially. Depth 4 is
    recommended for interactive use; depth 6–8 for analysis.
    """
    data = await proxy("post", "/best-move", json=body.model_dump())
    return BestMoveResponse(**data)


@app.post(
    "/api/v1/evaluate",
    response_model=EvaluationResponse,
    summary="Evaluate a position",
    tags=["engine"],
    responses={
        400: {"description": "Invalid FEN."},
        503: {"description": "Engine server unreachable."},
    },
)
async def evaluate(body: EvaluationRequest) -> EvaluationResponse:
    """
    Statically evaluate a chess position.

    Returns a centipawn score from White's perspective, material balance,
    game phase classification, and basic game-state flags. Useful for
    building datasets or integrating with ML pipelines.
    """
    data = await proxy("post", "/evaluate", json=body.model_dump())
    return EvaluationResponse(**data)


@app.post(
    "/api/v1/legal-moves",
    response_model=LegalMovesResponse,
    summary="Get legal moves for a piece",
    tags=["engine"],
    responses={
        400: {"description": "Invalid FEN or square."},
        503: {"description": "Engine server unreachable."},
    },
)
async def legal_moves(body: LegalMovesRequest) -> LegalMovesResponse:
    """
    Return all legal destination squares for the piece on a given square.

    Returns an empty list if the square is empty, it is not that piece's turn,
    or the piece has no legal moves (e.g. it is pinned).
    """
    data = await proxy("post", "/legal-moves", json=body.model_dump())
    return LegalMovesResponse(**data)