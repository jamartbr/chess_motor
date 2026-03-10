# ♟️ Chess Motor

[![CI](https://github.com/jamartbr/chess_motor/actions/workflows/ci.yml/badge.svg)](https://github.com/jamartbr/chess_motor/actions)
[![License](https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://chess-motor.vercel.app)

A full-stack chess engine built from scratch — no chess libraries, no shortcuts.  
TypeScript engine · FastAPI gateway · Vue 3 UI · Docker Compose · CI/CD

**[▶ Play live](https://chess-motor.vercel.app)** · **[API docs](https://chess-motor.onrender.com/docs)**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
│                    Vue 3 + Vite  :5173                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  │
┌─────────────────┐ ┌─────────────────┐         │
│  Python FastAPI │ │  Node.js Engine │         │
│  Gateway :8000  │ │  Server  :3000  │◄────────┘
│                 │ │                 │  WebSocket
│  OpenAPI /docs  │ │  REST + WS      │  (multiplayer)
│  Pydantic v2    │ │  Express        │
└────────┬────────┘ └────────┬────────┘
         │   proxy           │
         └──────────────────►│
                             │
                    ┌────────▼────────┐
                    │  TypeScript     │
                    │  Chess Engine   │
                    │  (library)      │
                    │                 │
                    │  0x88 board     │
                    │  Legal moves    │
                    │  Evaluation     │
                    │  Minimax + α/β  │
                    └─────────────────┘
```

### Monorepo structure

```
chess_motor/
├── packages/
│   ├── engine/          # Core chess logic (TypeScript)
│   ├── server/          # Node.js REST + WebSocket server
│   ├── python-api/      # FastAPI gateway (OpenAPI, Pydantic v2)
│   └── web/             # Vue 3 + Vite frontend
├── docker-compose.yml
├── .github/workflows/ci.yml
└── package.json         # npm workspaces root
```

---

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/jamartbr/chess_motor.git
cd chess_motor
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Python API + Swagger UI | http://localhost:8000/docs |
| Engine API (raw) | http://localhost:3000 |

### Local development

```bash
npm install           # installs all workspaces
npm run build -w packages/engine

# Terminal 1 — engine server
cd packages/server && npm run dev

# Terminal 2 — Vue frontend
cd packages/web && npm run dev

# Terminal 3 — Python API gateway
cd packages/python-api
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## API Reference

The Python gateway exposes a typed REST API with auto-generated OpenAPI documentation.

### `POST /api/v1/move`

Apply a move to a position.

```json
// Request
{
  "fen":  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "from": "e2",
  "to":   "e4"
}

// Response
{
  "fen":          "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "san":          "e4",
  "is_check":     false,
  "is_checkmate": false,
  "is_game_over": false,
  "winner":       null
}
```

### `POST /api/v1/best-move`

Find the engine's best move at a given search depth.

```json
// Request
{ "fen": "...", "depth": 4 }

// Response
{
  "from":     "d2",
  "to":       "d4",
  "score":    45.0,
  "depth":    4,
  "nodes":    18432,
  "time_ms":  63
}
```

### `POST /api/v1/evaluate`

Static position evaluation — useful for building training datasets.

```json
// Response
{
  "score":            30.0,
  "phase":            "opening",
  "material_balance": 0.0,
  "is_check":         false,
  "is_checkmate":     false,
  "is_stalemate":     false,
  "legal_move_count": 20
}
```

### `POST /api/v1/legal-moves`

Return all legal destinations for a piece.

```json
// Request  { "fen": "...", "square": "e2" }
// Response { "square": "e2", "moves": ["e3", "e4"], "count": 2 }
```

Full interactive docs at **`/docs`** (Swagger UI) and **`/redoc`**.

---

## Engine Design

The engine is implemented from scratch in TypeScript with no external chess libraries.

### Board representation — 0x88

Squares are indexed in a 128-element array where off-board detection is a single bitwise operation:

```typescript
isOnBoard(index: number): boolean {
    return (index & 0x88) === 0;
}
```

A square `s` has rank `s >> 4` and file `s & 7`. The difference between any two valid squares always has `(diff & 0x88) === 0` — this is exploited in sliding-piece generation to detect when a ray has left the board without any branching.

### Legal move generation

Moves are generated in two passes:

1. **Pseudo-legal generation** — geometrically valid moves ignoring king safety
2. **Legality filter** — for each candidate move, `makeMove` is applied silently, the king's square is checked for attack, then `undoMove` restores the state

This make/undo approach avoids maintaining incremental attack tables at the cost of ~20 extra board reads per legal move. For a non-competitive engine targeting interactive use, the simplicity tradeoff is correct.

### Move execution and undo

Every `makeMove` call pushes a `SavedState` snapshot (castling rights, en-passant square, half-move clock) onto a stack. `undoMove` pops it and reverses all grid mutations — including en-passant pawn removal, castling rook relocation, and promotion reversion.

Critical invariant: **the board state after `undoMove` is bit-for-bit identical to the state before `makeMove`**. The test suite verifies this property explicitly.

### Evaluation

The static evaluator combines:

- **Material count** — FIDE standard values (P=100, N=B=300, R=500, Q=900)
- **Piece-square tables** — positional bonuses/penalties per piece per square, phase-interpolated between opening and endgame tables
- **Game phase detection** — based on remaining material; smoothly interpolates evaluation weights

### SAN generation

Standard Algebraic Notation is built post-move (the board already reflects the new position, making check/checkmate detection trivial). Disambiguation is handled by scanning for sibling pieces of the same type that can also reach the destination square, then appending file, rank, or both as needed.

---

## Benchmarks

Measured on Apple M2, Node.js 20, single thread.

| Operation | Time |
|---|---|
| Legal move generation (starting position) | ~0.04 ms |
| Full perft(4) — 197,281 nodes | ~180 ms |
| Static evaluation | ~0.01 ms |
| Best move, depth 4 (midgame) | ~60–120 ms |
| Best move, depth 6 (midgame) | ~1.2–3 s |

> **Perft** (performance test) counts the exact number of leaf nodes at a given depth. It is the standard correctness benchmark for chess move generators — any deviation from known values indicates a bug. At depth 4 from the starting position the correct count is **197,281**.

---

## Testing

```bash
# Engine unit tests (Vitest)
npm test -w packages/engine

# Python API tests (pytest + respx mocks)
cd packages/python-api && pytest tests.py -v
```

The engine test suite covers:

- Board initialisation and `reset()`
- All piece movement rules (knight, bishop, rook, queen, king, pawn)
- En passant: setting the square, clearing it, capturing, and undo correctness
- Castling: rights, blocked squares, king in check, rook/king placement after castling
- Pin detection (pieces that cannot move without exposing the king)
- Check, checkmate (Scholar's mate), and stalemate detection
- SAN generation including file/rank disambiguation
- Draw conditions: threefold repetition, 50-move rule, insufficient material
- `undoMove` correctness for captures, castling, en passant, and promotion
- Analyzer: score delta, forced-mate labelling, board immutability

---

## Game Modes

| Mode | Description |
|---|---|
| **Classical** | Standard FIDE rules. Win by checkmate. |
| **Dominion** | Accumulate territory points per move. Win by total score. |
| **Analysis** | Click any piece to see legal moves annotated with score impact (`+1.0`, `-9.0`, `M1`). |

---

## Design Decisions

**Why 0x88 instead of bitboards?**  
Bitboard engines (Stockfish, Leela) use 64-bit integers for extremely fast bulk operations, but require a population-count CPU instruction and non-trivial bit manipulation for move generation. 0x88 offers the same O(1) off-board detection with code that is readable without deep bit-twiddling knowledge — the right tradeoff for a project whose primary goal is demonstrating clean architecture.

**Why make/undo instead of copy-make?**  
Copy-make (duplicating the entire board state before each move) is simpler to implement but allocates heavily in the inner search loop. Make/undo is more complex but allocation-free, which matters at depth 6+ where millions of positions are visited.

**Why a separate Python gateway instead of calling the engine directly?**  
The TypeScript engine is the canonical implementation. The Python layer adds: auto-generated OpenAPI documentation, Pydantic request validation with descriptive error messages, and a language that is natural for ML/data pipelines that may want to consume position evaluations. It is intentionally thin — a proxy, not a reimplementation.

**Why FEN as the universal interface?**  
FEN (Forsyth-Edwards Notation) is the chess standard for position serialisation. Every endpoint being stateless and FEN-based means the API is trivially composable: you can pipe the output `fen` of one `/move` call directly into the next without any session management.

---

## Stack

| Layer | Technology |
|---|---|
| Engine | TypeScript, 0x88 board representation |
| Server | Node.js, Express, Socket.IO |
| API gateway | Python 3.12, FastAPI, Pydantic v2, httpx |
| Frontend | Vue 3, Vite, Tailwind CSS |
| Tests | Vitest (TS), pytest + respx (Python) |
| CI/CD | GitHub Actions |
| Containers | Docker, Docker Compose, Nginx |

---

## Author

**Jaime Martínez Bravo** · [GitHub](https://github.com/jamartbr)