# Architecture

    apps/
      api/src/
        main.ts                   process entry (connects RabbitMQ, starts HTTP)
        app.ts                    composition root, wires modules
        config/                   zod-validated env
        shared/                   cross-cutting (errors, http helpers), no business logic
        infrastructure/messaging  EventBus port + RabbitMQ / in-memory adapters
        modules/<name>/           one bounded context each; public API = index.ts
      web/app/
        pages/                    Nuxt routes (SSR)
        modules/<name>/           frontend feature code mirroring API modules
