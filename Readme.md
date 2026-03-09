# ♟️ Chess Engine

## Overview

A full-stack chess engine built from scratch, featuring a TypeScript-based engine with move generation and evaluation algorithms, a Node.js API backend, and a Vue 3 web interface. This project helped me adquiring knowledge in low-level game logic, API design, and modern frontend development.

## Key Features

- **Custom Move Generation**: Bitboard-based move generation with legal move validation
- **Evaluation Engine**: Position evaluation with material count, piece placement, and tactical patterns
- **Scalable Architecture**: Monorepo structure separating concerns across engine, server, and client
- **Production Deployment**: API hosted on Render, frontend deployed on Vercel
- **Comprehensive Testing**: Unit tests for engine logic using Vitest

## Technical Highlights

- Implemented chess rules engine without external libraries
- RESTful API for real-time move computation
- Responsive web UI with game state management
- CI/CD pipeline ready for deployment

## Structure

```
packages/
├── engine/   # Engine: move generation, evaluation, tests
├── server/   # API exposing the engine as a service (deployed on Render)
└── web/      # Web interface to play against the engine (deployed on Vercel)
```

## Stack

| Package | Technology |
|---------|-----------|
| engine  | TypeScript, Vitest |
| server  | TypeScript, Node.js |
| web     | Vue 3, Vite, TypeScript |

## Demo

🌐 [Play here](https://chess-motor.vercel.app/)

## Installation

### Requirements
- Node.js >= 18
- npm

### Engine
```bash
cd packages/engine
npm install
npm test          # run tests with Vitest
```

### Server
```bash
cd packages/server
npm install
npm run dev
```

### Web
```bash
cd packages/web
npm install
npm run dev
```

## License

MIT License with Commons Clause — see [LICENSE](./LICENSE) for the full text.

## Author

Jaime Martínez Bravo · [GitHub](https://github.com/jamartbr)