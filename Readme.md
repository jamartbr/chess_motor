# ♟️ Chess Motor

Motor de ajedrez desarrollado desde cero con arquitectura full-stack.

## Estructura

```
packages/
├── engine/   # Motor: generación de movimientos, búsqueda minimax + alpha-beta, evaluación
├── server/   # API que expone el motor como servicio (desplegado en Render)
└── web/      # Interfaz web para jugar contra el motor (desplegado en Vercel)
```

## Stack

| Paquete | Tecnología |
|---------|-----------|
| engine  | TypeScript, Vitest |
| server  | TypeScript, Node.js |
| web     | Vue 3, Vite, TypeScript |

## Demo

🌐 [Jugar aquí](https://your-vercel-url.vercel.app) <!-- Reemplaza con tu URL real -->

## Instalación

### Requisitos
- Node.js >= 18
- npm

### Engine
```bash
cd packages/engine
npm install
npm test          # ejecuta los tests con Vitest
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

## Licencia

MIT License con Commons Clause — ver [LICENSE](./LICENSE) para el texto completo.

## Autor

Jaime Martínez Bravo · [GitHub](https://github.com/tu-usuario)