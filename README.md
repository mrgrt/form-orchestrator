# form-orchestrator

> Lightweight, backend-agnostic frontend orchestration middleware for form submissions.

`form-orchestrator` sits between your browser-rendered forms and your downstream backend (Gravity Forms / WordPress, REST APIs, anything). It runs inside a Next.js Route Handler (or any Node BFF), resolves contextual entities server-side, builds a canonical context, enriches the payload with trusted values, and forwards the submission via a pluggable transport adapter.

It is intentionally small. It is **not** a form builder, validator, or backend framework. It is the thin orchestration seam that keeps trusted values off the client and keeps your route handlers a one-liner.

---

## Table of contents

1. [What Form Orchestrator is](#1-what-form-orchestrator-is)
2. [Core architecture concepts](#2-core-architecture-concepts)
3. [Installation](#3-installation)
4. [Example Next.js integration](#4-example-nextjs-integration)
5. [Example form config](#5-example-form-config)
6. [Example API resolver](#6-example-api-resolver)
7. [Example function resolver](#7-example-function-resolver)
8. [Example Gravity Forms adapter](#8-example-gravity-forms-adapter)
9. [Canonical context explanation](#9-canonical-context-explanation)
10. [Submission-time interception](#10-submission-time-interception)
11. [Backend adapter architecture](#11-backend-adapter-architecture)
12. [Philosophy & goals](#12-philosophy--goals)

---

## 1. What Form Orchestrator is

When a form is submitted, three concerns get tangled together:

- **Presentation context** — the slug in the URL, the variant the user is viewing, the locale they selected. The frontend owns this.
- **Trusted entity data** — the database row that slug maps to, the IDs the backend cares about. The backend owns this.
- **Transport format** — GraphQL mutations, REST JSON, multipart, etc. The receiving system dictates this.

Form Orchestrator gives each concern a clear seam:

| Concern | Where it lives |
| --- | --- |
| Presentation context | URL params on the BFF route |
| Trusted entity resolution | `context` resolvers in the form config |
| Canonical entity shape | The canonical context built server-side |
| Transport format | Adapters (`gravityForms`, `rest`, custom) |

It is intentionally **not**:

- ❌ a full backend framework
- ❌ a form builder
- ❌ a validation engine
- ❌ a replacement for backend business logic

---

## 2. Core architecture concepts

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Browser                                     │
│                                                                          │
│   user-controlled values only — no IDs, no presetValues, no hidden       │
│   fields containing trusted data                                         │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  POST /api/forms/<formKey>?slug=...
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Next.js Route Handler (BFF)                        │
│                                                                          │
│      orchestrateSubmission({ formKey, request })                         │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │  form-orchestrator                                               │   │
│   │                                                                  │   │
│   │   1. load <formKey>.json                                         │   │
│   │   2. adapter.decode(req)            → { params, payload }        │   │
│   │   3. resolveContext(config.context) → { trainer, ... }           │   │
│   │   4. applyMetadata(config.metadata) → adds submission.source     │   │
│   │   5. adapter.submit({ payload, params, canonicalContext })       │   │
│   └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  transport-formatted request
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│   Backend (WordPress / WPGraphQL / REST API / your own service)          │
│   — owns business authority, validation, persistence, side effects       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Layered ownership

- **Frontend owns presentation context** — slugs, variants, route params.
- **Backend owns business authority** — IDs, ACLs, validation, persistence.
- **Orchestration is backend-agnostic** — it shuttles canonical data, never opinions.
- **Adapters handle transport formatting** — they're the only place that knows about GraphQL or REST or anything else.
- **Trusted values are injected server-side only** — never travel to the browser, never round-trip through hidden fields.

---

## 3. Installation

```bash
npm install form-orchestrator
```

Requires Node.js ≥ 18 (uses the built-in `fetch`).

> The package is published as ESM. If you're on a non-Next.js stack, make sure your runtime supports ESM imports.

---

## 4. Example Next.js integration

### Route handler

```ts
// app/api/forms/[formKey]/route.ts
import { orchestrateSubmission } from "form-orchestrator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formKey: string }> },
) {
  const { formKey } = await params;
  return orchestrateSubmission({ formKey, request });
}
```

That's it. No business logic, no transport details, no field maps in code.

### Pointing your form at the BFF

If you're using `next-gravity-forms`, set the form's `baseUrl` to the BFF route. The library will POST its GraphQL mutation there instead of going directly to WordPress.

```tsx
"use client";
import GravityFormForm from "next-gravity-forms";

export default function TestimonialForm({ data, slug }) {
  const baseUrl = `/api/forms/testimonial?slug=${encodeURIComponent(slug)}`;
  return <GravityFormForm data={data} baseUrl={baseUrl} />;
}
```

### Environment variables

```bash
API_BASE_URL=http://localhost                 # prefix for relative API resolver endpoints
FORM_API_ENDPOINT=http://localhost/wp/graphql # gravityForms adapter target
FORM_ORCHESTRATOR_DEBUG=1                     # verbose server-side logs
```

---

## 5. Example form config

A form config is plain JSON. It lives wherever you want — by default at `<cwd>/src/configs/forms/<formKey>.json`. Pass `configDir` to `orchestrateSubmission` to override.

```json
{
  "adapter": {
    "type": "gravityForms",
    "formId": 2,
    "fields": {
      "input_6": "{{trainer.id}}",
      "input_7": "{{trainer.slug}}",
      "input_8": "public_testimonial_form"
    }
  },
  "context": {
    "trainer": {
      "source": "params.slug",
      "resolver": {
        "type": "api",
        "endpoint": "/wp-json/pt-dashboard/v1/directory/trainers/{value}"
      }
    }
  },
  "metadata": {
    "submission.source": "public_testimonial_form"
  }
}
```

### Adapter `fields` semantics

The map's keys are whatever the adapter expects (Gravity Forms uses `input_<id>`). The values follow two simple rules:

- A **plain string** is treated as a literal — `"public_testimonial_form"` is just that string.
- A **`{{path}}` expression** is interpolated against the canonical context — `"{{trainer.id}}"` looks up `canonicalContext.trainer.id`.

No magic, no surprise lookups.

### `context`

Each entry under `context` declares an entity to resolve. `source` (optional) is a [source path](#source-paths) into the resolution context. The resolver decides _how_ to fetch it.

### `metadata`

Optional dotted-path overlays applied **after** context resolution. Useful for stamping in literals or rewiring values into the canonical shape your adapter expects.

### Source paths

Anywhere a string is interpreted as a "source", these prefixes resolve into the runtime [resolution context](#resolution-context-vs-canonical-context):

- `params.<key>` — URL params on the BFF route
- `payload.<key>` — user-submitted body fields (decoded by the adapter)
- `context.<key>` — already-resolved entities (later resolvers can reference earlier ones)

---

## 6. Example API resolver

Looks up `params.slug` against an HTTP endpoint. `{value}` is substituted with the source value.

```json
"trainer": {
  "source": "params.slug",
  "resolver": {
    "type": "api",
    "endpoint": "/wp-json/pt-dashboard/v1/directory/trainers/{value}"
  }
}
```

Relative endpoints are prefixed with `API_BASE_URL`. Fully qualified URLs (`http://...`) are used as-is.

The JSON response becomes `canonicalContext.trainer`.

---

## 7. Example function resolver

For data that comes from local code rather than HTTP. Reference a handler by name:

```json
"submission": {
  "resolver": {
    "type": "function",
    "handler": "resolveSubmissionMeta"
  }
}
```

Provide handlers via the `resolvers` option:

```ts
import { orchestrateSubmission } from "form-orchestrator";

await orchestrateSubmission({
  formKey,
  request,
  resolvers: {
    resolveSubmissionMeta: async ({ value, context }) => ({
      timestamp: new Date().toISOString(),
      ip: context.params.ip,
    }),
  },
});
```

Handlers receive `{ value, context }` where `value` is `source` resolved (if present) and `context` is the full {@link ResolutionContext}.

A `resolveSubmissionMeta` handler ships in `defaultResolverHandlers`.

---

## 8. Example Gravity Forms adapter

The `gravityForms` adapter understands the `next-gravity-forms` GraphQL submission shape. Given a config like:

```json
{
  "adapter": {
    "type": "gravityForms",
    "formId": 2,
    "fields": {
      "input_6": "{{trainer.id}}",
      "input_7": "{{trainer.slug}}",
      "input_8": "public_testimonial_form"
    }
  }
}
```

…and a canonical context like:

```json
{
  "trainer": { "id": 88, "slug": "grahamethomson" },
  "submission": { "source": "public_testimonial_form" }
}
```

…the adapter encodes a `submitGfForm` mutation against your WordPress GraphQL endpoint where the relevant inputs become:

```json
{
  "input_6": 88,
  "input_7": "grahamethomson",
  "input_8": "public_testimonial_form"
}
```

User-submitted values for other inputs (`input_1`, `input_2`, …) pass through unchanged. Adapter-mapped inputs **always win** over user-submitted values for the same key — that's the trust boundary.

---

## 9. Canonical context explanation

The **canonical context** is the trusted, backend-agnostic representation of everything orchestration knows about a submission after running resolvers and metadata.

### Resolution context vs canonical context

| | Resolution context | Canonical context |
| --- | --- | --- |
| Purpose | Inputs to the resolution step | Output passed to the adapter |
| Shape | `{ params, payload, context }` | Whatever your `context` + `metadata` produced |
| Trusted? | `params` and `payload` are user-controlled; `context` is trusted | Fully trusted |
| Used by | `params.x` / `payload.x` / `context.x` source paths | `{{path}}` expressions in adapter `fields` |

Example canonical context for a testimonial submission:

```json
{
  "trainer": {
    "id": 88,
    "slug": "grahamethomson"
  },
  "submission": {
    "source": "public_testimonial_form"
  }
}
```

The adapter `fields` map then projects this into whatever shape the downstream backend expects. Same canonical data, different transports.

---

## 10. Submission-time interception

This is the security model.

> **The browser never sees trusted values. The browser never submits to the backend. The browser submits to the BFF, and the BFF submits to the backend.**

Things `form-orchestrator` deliberately does **not** do:

- ❌ inject trusted values via `presetValues`
- ❌ inject trusted values via hidden fields rendered in HTML
- ❌ trust IDs sent from the browser

The flow:

```
Browser  ──► /api/forms/<formKey>  ──► resolveContext  ──► adapter.submit  ──► Backend
         (user values + slug)         (trusted lookup)       (transport)
```

Anywhere along the way, if the browser tries to send (say) `input_6: 999` to spoof a `trainer.id`, the adapter's `fields` map overwrites it with the value resolved from `params.slug`. The trust boundary is the adapter's `fields` merge.

This is why `form-orchestrator` requires an explicit BFF route. There is no shortcut.

---

## 11. Backend adapter architecture

Adapters isolate transport concerns. They implement two methods:

```ts
interface FormAdapter<TConfig extends AdapterConfig = AdapterConfig> {
  decode(req: Request, config: TConfig): Promise<CanonicalEnvelope>;
  submit(args: AdapterSubmitArgs<TConfig>): Promise<Response>;
  resolveTarget(config: TConfig): string | undefined;
}
```

- `decode` parses the incoming HTTP request into a canonical `{ params, payload }` envelope.
- `submit` takes the user payload + trusted canonical context + adapter config and produces an outgoing HTTP request in whatever shape the backend expects.
- `resolveTarget` returns the configured destination URL (used by debug logs).

Two adapters ship with the package:

- **`gravityFormsAdapter`** — speaks the `submitGfForm` GraphQL mutation expected by [`wp-graphql-gravity-forms`](https://github.com/harness-software/wp-graphql-gravity-forms) and consumed by [`next-gravity-forms`](https://www.npmjs.com/package/next-gravity-forms).
- **`restAdapter`** — generic JSON pass-through. Forwards `{ params, payload, context }` as a JSON body.

### Writing your own adapter

```ts
import type { FormAdapter, AdapterSubmitArgs } from "form-orchestrator";
import { enrichPayload } from "form-orchestrator";

type StripeAdapterConfig = {
  type: "stripeCheckout";
  endpoint?: string;
  fields?: Record<string, string>;
};

export const stripeAdapter: FormAdapter<StripeAdapterConfig> = {
  async decode(req) {
    const body = await req.json();
    return { params: {}, payload: body };
  },

  async submit({ payload, canonicalContext, config }: AdapterSubmitArgs<StripeAdapterConfig>) {
    const enriched = enrichPayload(payload, config.fields, canonicalContext);
    return fetch(config.endpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
    });
  },

  resolveTarget(config) {
    return config.endpoint;
  },
};
```

Register it at the call site:

```ts
return orchestrateSubmission({
  formKey,
  request,
  adapters: { stripeCheckout: stripeAdapter },
});
```

---

## 12. Philosophy & goals

- **Lightweight first.** No bundler, no runtime dependencies. Plain TypeScript on top of Node 18+.
- **Backend-agnostic core.** The orchestration loop knows nothing about Gravity Forms, WordPress, or any specific backend. All of that lives in adapters.
- **Configuration over code.** New forms are JSON files, not classes. Resolvers and adapters are referenced by name.
- **One-line route handlers.** Your BFF route is `return orchestrateSubmission({ formKey, request })` and stays that way.
- **Security by default.** Trusted values are server-side only. There is no client-side path that can spoof them.
- **Composable building blocks.** If `orchestrateSubmission` is too opinionated, drop down to `resolveContext`, `applyMetadata`, `enrichPayload`, and `gravityFormsAdapter` directly.
- **Beginner-friendly.** A teammate who has never seen the package should be able to add a new form by copying a config file.

---

## Public API

```ts
import {
  // High-level
  orchestrateSubmission,

  // Building blocks
  resolveContext,
  resolveContextEntity,
  applyMetadata,
  enrichPayload,
  loadFormConfig,

  // Adapters
  gravityFormsAdapter,
  restAdapter,
  defaultAdapters,

  // Resolver handlers
  defaultResolverHandlers,
  resolveSubmissionMeta,

  // Utilities
  getNestedValue,
  setNestedValue,
  interpolate,
  isSourcePath,
  resolveSourceValue,
} from "form-orchestrator";

import type {
  AdapterConfig,
  AdapterRegistry,
  AdapterSubmitArgs,
  ApiResolver,
  CanonicalEnvelope,
  ContextEntityConfig,
  FormAdapter,
  FormConfig,
  FunctionResolver,
  GravityFormsAdapterConfig,
  ResolutionContext,
  Resolver,
  ResolverHandler,
  ResolverHandlerArgs,
  RestAdapterConfig,
} from "form-orchestrator";
```

---

## Project structure

```
form-orchestrator/
  src/
    adapters/
      gravityForms.ts     # GraphQL submitGfForm
      rest.ts             # generic JSON pass-through
      index.ts            # defaultAdapters registry
    core/
      context.ts          # applyMetadata
      resolvers.ts        # resolveContext, resolveContextEntity
      enrichment.ts       # enrichPayload
      orchestrate.ts      # orchestrateSubmission (full lifecycle)
      loadFormConfig.ts   # JSON config loader
      debug.ts            # internal debug logging
    handlers/
      resolver-handlers.ts
    types/
      index.ts
    utils/
      getNestedValue.ts
      resolveSourceValue.ts
    index.ts              # public exports

  examples/
    nextjs-gravity-forms/  # illustrative integration

  README.md
  LICENSE                  # MIT
  package.json
  tsconfig.json
  .gitignore
```

> The recommended-structure that inspired this layout listed only `context.ts`, `resolvers.ts`, and `enrichment.ts` under `core/`. `orchestrate.ts`, `loadFormConfig.ts`, and `debug.ts` were added as natural extensions so the public API has a place to land. Everything not listed in [Public API](#public-api) is an implementation detail.

---

## License

[MIT](./LICENSE) © Grahame Thomson
