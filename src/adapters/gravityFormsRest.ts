import type {
  CanonicalEnvelope,
  FormAdapter,
  GravityFormsRestAdapterConfig,
} from "../types/index.js";
import { interpolate } from "../utils/resolveSourceValue.js";

function readSearchParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URL(url).searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function resolveRestBase(config: GravityFormsRestAdapterConfig): string | undefined {
  if (config.endpoint) return config.endpoint.replace(/\/$/, "");
  const explicit = process.env.GRAVITY_FORMS_REST_BASE?.replace(/\/$/, "");
  if (explicit) return explicit;
  const wp = (
    process.env.WORDPRESS_URL ??
    process.env.NEXT_PUBLIC_WORDPRESS_URL ??
    ""
  ).replace(/\/$/, "");
  if (!wp) return undefined;
  return `${wp}/wp-json/gf/v2`;
}

function submissionsUrl(base: string, formId: number): string {
  return `${base}/forms/${formId}/submissions`;
}

/**
 * Normalize a `fields` config key into a Gravity Forms input name.
 *   "6"        → "input_6"
 *   "1.3"      → "input_1_3"      (sub-field, e.g. name/address)
 *   "input_6"  → "input_6"        (passthrough)
 *   "input_1_3" → "input_1_3"     (passthrough)
 */
function toGfInputKey(key: string): string {
  if (key.startsWith("input_")) return key;
  return `input_${key.replace(/\./g, "_")}`;
}

/**
 * Gravity Forms REST API v2 adapter — POSTs to
 * `/wp-json/gf/v2/forms/{id}/submissions` with `input_*` keys.
 *
 * Decodes a JSON body whose keys are Gravity Forms input names (e.g.
 * `input_1`, `input_1_3`, `input_4`). Query string becomes `params`.
 *
 * Trusted values use the same `fields` map + `{{path}}` interpolation as the
 * GraphQL adapter; injected keys always overwrite user-supplied values.
 *
 * @see https://docs.gravityforms.com/submitting-forms-with-rest-api-v2/
 */
export const gravityFormsRestAdapter: FormAdapter<GravityFormsRestAdapterConfig> = {
  async decode(req): Promise<CanonicalEnvelope> {
    const params = readSearchParams(req.url);
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key === "field_values") continue;
      if (key.startsWith("input_")) payload[key] = value;
      if (key === "source_page" || key === "target_page") payload[key] = value;
    }

    return { params, payload };
  },

  async submit({ payload, canonicalContext, config }) {
    const base = resolveRestBase(config);
    if (!base) {
      throw new Error(
        "gravityFormsRest adapter: no REST base URL (set adapter.endpoint, GRAVITY_FORMS_REST_BASE, or WORDPRESS_URL / NEXT_PUBLIC_WORDPRESS_URL).",
      );
    }

    const merged: Record<string, unknown> = { ...payload };

    if (config.fields) {
      for (const [rawKey, rawValue] of Object.entries(config.fields)) {
        merged[toGfInputKey(rawKey)] = interpolate(rawValue, canonicalContext);
      }
    }

    if (merged.source_page === undefined) merged.source_page = 1;
    if (merged.target_page === undefined) merged.target_page = 0;

    const url = submissionsUrl(base, config.formId);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(merged),
    });
  },

  resolveTarget(config) {
    const base = resolveRestBase(config);
    if (!base) return undefined;
    return submissionsUrl(base, config.formId);
  },
};
