"""
Tests for the Chess Motor Python API Gateway.

Uses pytest + httpx.AsyncClient to test the FastAPI app directly without
spinning up the Node engine server — the engine calls are mocked via
respx (httpx mock library).

Run:
    pip install pytest pytest-asyncio respx
    pytest tests/ -v
"""

import pytest
import respx
import httpx
from httpx import AsyncClient
from fastapi.testclient import TestClient

from main import app, ENGINE_URL

# ── Fixtures ──────────────────────────────────────────────────────────────────

STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"

client = TestClient(app)


# ── Health ────────────────────────────────────────────────────────────────────

@respx.mock
def test_health_ok():
    respx.get(f"{ENGINE_URL}/health").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["engine_reachable"] is True
    assert body["version"] == "1.0.0"


@respx.mock
def test_health_degraded_when_engine_down():
    respx.get(f"{ENGINE_URL}/health").mock(side_effect=httpx.ConnectError("refused"))
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "degraded"
    assert resp.json()["engine_reachable"] is False


# ── POST /api/v1/move ─────────────────────────────────────────────────────────

@respx.mock
def test_apply_move_success():
    respx.post(f"{ENGINE_URL}/move").mock(return_value=httpx.Response(200, json={
        "fen":           AFTER_E4_FEN,
        "san":           "e4",
        "is_check":      False,
        "is_checkmate":  False,
        "is_game_over":  False,
        "winner":        None,
    }))
    resp = client.post("/api/v1/move", json={
        "fen":  STARTING_FEN,
        "from": "e2",
        "to":   "e4",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["san"] == "e4"
    assert body["fen"] == AFTER_E4_FEN
    assert body["is_check"] is False


@respx.mock
def test_apply_move_illegal():
    respx.post(f"{ENGINE_URL}/move").mock(return_value=httpx.Response(400, json={"error": "Illegal move"}))
    resp = client.post("/api/v1/move", json={
        "fen":  STARTING_FEN,
        "from": "e2",
        "to":   "e5",  # not legal from start
    })
    assert resp.status_code == 400


def test_apply_move_invalid_square_format():
    """Pydantic validator should reject squares outside a1-h8."""
    resp = client.post("/api/v1/move", json={
        "fen":  STARTING_FEN,
        "from": "z9",
        "to":   "e4",
    })
    assert resp.status_code == 422  # Unprocessable Entity


def test_apply_move_missing_field():
    resp = client.post("/api/v1/move", json={"fen": STARTING_FEN, "from": "e2"})
    assert resp.status_code == 422


# ── POST /api/v1/best-move ────────────────────────────────────────────────────

@respx.mock
def test_best_move_success():
    respx.post(f"{ENGINE_URL}/best-move").mock(return_value=httpx.Response(200, json={
        "from":      "e2",
        "to":        "e4",
        "promotion": None,
        "score":     30.0,
        "depth":     4,
        "nodes":     12480,
        "time_ms":   42,
    }))
    resp = client.post("/api/v1/best-move", json={"fen": STARTING_FEN, "depth": 4})
    assert resp.status_code == 200
    body = resp.json()
    assert body["from"] == "e2"
    assert body["depth"] == 4
    assert isinstance(body["nodes"], int)


def test_best_move_depth_out_of_range():
    resp = client.post("/api/v1/best-move", json={"fen": STARTING_FEN, "depth": 99})
    assert resp.status_code == 422


# ── POST /api/v1/evaluate ─────────────────────────────────────────────────────

@respx.mock
def test_evaluate_starting_position():
    respx.post(f"{ENGINE_URL}/evaluate").mock(return_value=httpx.Response(200, json={
        "score":            0.0,
        "phase":            "opening",
        "material_balance": 0.0,
        "is_check":         False,
        "is_checkmate":     False,
        "is_stalemate":     False,
        "legal_move_count": 20,
    }))
    resp = client.post("/api/v1/evaluate", json={"fen": STARTING_FEN})
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 0.0
    assert body["phase"] == "opening"
    assert body["legal_move_count"] == 20


# ── POST /api/v1/legal-moves ──────────────────────────────────────────────────

@respx.mock
def test_legal_moves_e2_pawn():
    respx.post(f"{ENGINE_URL}/legal-moves").mock(return_value=httpx.Response(200, json={
        "square": "e2",
        "moves":  ["e3", "e4"],
        "count":  2,
    }))
    resp = client.post("/api/v1/legal-moves", json={"fen": STARTING_FEN, "square": "e2"})
    assert resp.status_code == 200
    body = resp.json()
    assert "e3" in body["moves"]
    assert "e4" in body["moves"]
    assert body["count"] == 2


def test_legal_moves_invalid_square():
    resp = client.post("/api/v1/legal-moves", json={"fen": STARTING_FEN, "square": "x9"})
    assert resp.status_code == 422


# ── Engine unreachable ────────────────────────────────────────────────────────

@respx.mock
def test_503_when_engine_unreachable():
    respx.post(f"{ENGINE_URL}/move").mock(side_effect=httpx.ConnectError("refused"))
    resp = client.post("/api/v1/move", json={
        "fen":  STARTING_FEN,
        "from": "e2",
        "to":   "e4",
    })
    assert resp.status_code == 503
    assert "unreachable" in resp.json()["detail"].lower()