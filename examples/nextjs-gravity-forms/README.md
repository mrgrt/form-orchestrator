# Example: Next.js + Gravity Forms

A minimal illustration of integrating `form-orchestrator` into a Next.js App Router project that submits Gravity Forms via WordPress + WPGraphQL.

## Files

```
examples/nextjs-gravity-forms/
  app/
    api/
      forms/
        [formKey]/
          route.ts          # one-line route handler
  configs/
    forms/
      testimonial.json      # form config (adapter + context + metadata)
  .env.example              # required environment variables
```

## How the pieces fit

```
┌────────────┐      POST /api/forms/testimonial?slug=grahamethomson
│  Browser   │ ─────────────────────────────────────────────────────┐
└────────────┘                                                      ▼
                                                          ┌──────────────────┐
                                                          │  Next.js Route   │
                                                          │  (route.ts)      │
                                                          └─────────┬────────┘
                                                                    │
                                            orchestrateSubmission({ formKey, request })
                                                                    │
                                            ┌───────────────────────▼─────────────────────────┐
                                            │  form-orchestrator                              │
                                            │  1. load testimonial.json                       │
                                            │  2. adapter.decode(req)  → { params, payload }  │
                                            │  3. resolveContext(...)  → trainer (api lookup) │
                                            │  4. applyMetadata(...)   → submission.source    │
                                            │  5. adapter.submit(...)  → GraphQL mutation     │
                                            └───────────────────────┬─────────────────────────┘
                                                                    │
                                                    ┌───────────────▼───────────────┐
                                                    │  WordPress / WPGraphQL        │
                                                    │  submitGfForm mutation        │
                                                    └───────────────────────────────┘
```

## Browser → BFF, never browser → WordPress

Because submissions go to the local Next.js route, trusted values like `trainer.id` are looked up server-side and injected into the outgoing payload. The browser never sees them.

## Adding the package to your app

```bash
npm install form-orchestrator
```

The route handler is intentionally minimal — see `app/api/forms/[formKey]/route.ts`.
