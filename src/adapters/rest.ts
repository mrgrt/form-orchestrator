import type {
  CanonicalEnvelope,
  FormAdapter,
  RestAdapterConfig,
} from "../types/index.js";

function readSearchParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URL(url).searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function resolveEndpoint(config: RestAdapterConfig): string | undefined {
  return config.endpoint ?? process.env.FORM_API_ENDPOINT;
}

/**
 * Generic REST adapter — backend-agnostic JSON pass-through.
 *
 * The browser sends `{ params?, payload }`. The adapter forwards the user
 * payload alongside the trusted canonical context so any REST backend can
 * consume server-resolved values directly.
 *
 * Outgoing body shape:
 *   {
 *     "params":  { ... },           // presentation-layer params
 *     "payload": { ... },           // user-controlled values
 *     "context": { ... }            // canonical context (trusted)
 *   }
 */
export const restAdapter: FormAdapter<RestAdapterConfig> = {
  async decode(req): Promise<CanonicalEnvelope> {
    const queryParams = readSearchParams(req.url);
    const body = (await req.json()) as {
      params?: Record<string, unknown>;
      payload?: Record<string, unknown>;
    };
    return {
      params: { ...queryParams, ...(body.params ?? {}) },
      payload: body.payload ?? {},
    };
  },

  async submit({ payload, params, canonicalContext, config }) {
    const endpoint = resolveEndpoint(config);
    if (!endpoint) {
      throw new Error(
        "rest adapter: no endpoint configured (set adapter.endpoint or FORM_API_ENDPOINT).",
      );
    }

    return fetch(endpoint, {
      method: config.method ?? "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params, payload, context: canonicalContext }),
    });
  },

  resolveTarget(config) {
    return resolveEndpoint(config);
  },
};
