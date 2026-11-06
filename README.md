# imp-service

Modular monolith.

- `apps/api` - Express 5 + TypeScript + Zod, built with Vite, tested with Vitest
- `apps/web` - Nuxt (SSR) + TypeScript
- RabbitMQ for inter-module (async) events

## Getting started

    cp .env.example .env
    npm install
    npm run infra:up   # RabbitMQ (management UI: http://localhost:15672)
    npm run dev
    npm test

## Module rules (API)

Each folder in `apps/api/src/modules/<name>` is a module with a public surface in `index.ts`.

- Other modules may import only from `modules/<name>` (index.ts), never from its internals.
- Modules communicate asynchronously through events on the RabbitMQ bus (`infrastructure/messaging`), or through the public interface exported by the module.
- Keep Zod schemas at the module boundary (HTTP in, events in/out).
