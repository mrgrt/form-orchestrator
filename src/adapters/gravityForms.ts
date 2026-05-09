import type {
  CanonicalEnvelope,
  FormAdapter,
  GravityFormsAdapterConfig,
} from "../types/index.js";
import { interpolate } from "../utils/resolveSourceValue.js";

const SUBMIT_FORM_MUTATION = `
  mutation submitForm($id: ID!, $fieldValues: [FormFieldValuesInput]!) {
    submitGfForm(input: { id: $id, fieldValues: $fieldValues }) {
      errors {
        id
        message
      }
    }
  }
`;

const INPUT_KEY = /^input_(\d+)$/;

type FieldValueRecord = { id: number; [key: string]: unknown };

function readSearchParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URL(url).searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Convert a single FormFieldValuesInput object back to a flat payload value.
 * Simple fields (`value` / `values`) are surfaced as scalars/arrays so
 * payloads read naturally; richer field types (nameValues, addressValues,
 * etc.) are preserved as objects so they round-trip losslessly.
 */
function fieldValueToPayload(field: FieldValueRecord): unknown {
  const { id: _id, ...rest } = field;
  void _id;
  const keys = Object.keys(rest);
  if (keys.length === 1 && keys[0] === "value") return rest.value;
  if (keys.length === 1 && keys[0] === "values") return rest.values;
  return rest;
}

function payloadToFieldValue(id: number, value: unknown): FieldValueRecord {
  if (Array.isArray(value)) {
    return { id, values: value.map((v) => (v == null ? "" : String(v))) };
  }
  if (value !== null && typeof value === "object") {
    return { id, ...(value as Record<string, unknown>) };
  }
  return { id, value: value == null ? "" : String(value) };
}

function resolveEndpoint(config: GravityFormsAdapterConfig): string | undefined {
  return config.endpoint ?? process.env.FORM_API_ENDPOINT;
}

/**
 * Adapter for the [`wp-graphql-gravity-forms`](https://github.com/harness-software/wp-graphql-gravity-forms)
 * `submitGfForm` mutation. Decodes the incoming `next-gravity-forms` request,
 * applies the canonical-context-driven `fields` map, and re-emits the GraphQL
 * mutation against the configured WordPress endpoint.
 *
 * The canonical context lookup uses `{{path}}` interpolation:
 *
 *   "fields": {
 *     "input_6": "fooo",                  // literal
 *     "input_7": "{{trainer.id}}"         // canonical context lookup
 *   }
 */
export const gravityFormsAdapter: FormAdapter<GravityFormsAdapterConfig> = {
  async decode(req): Promise<CanonicalEnvelope> {
    const params = readSearchParams(req.url);

    const body = (await req.json()) as {
      variables?: { fieldValues?: FieldValueRecord[] };
    };
    const fieldValues = body.variables?.fieldValues ?? [];

    const payload: Record<string, unknown> = {};
    for (const field of fieldValues) {
      if (typeof field?.id !== "number") continue;
      payload[`input_${field.id}`] = fieldValueToPayload(field);
    }

    return { params, payload };
  },

  async submit({ payload, canonicalContext, config }) {
    const endpoint = resolveEndpoint(config);
    if (!endpoint) {
      throw new Error(
        "gravityForms adapter: no endpoint configured (set adapter.endpoint or FORM_API_ENDPOINT).",
      );
    }

    const merged: Record<string, unknown> = { ...payload };

    // Trusted fields injected from the canonical context. Plain strings are
    // literals; `{{path}}` references resolve against the canonical context.
    // These ALWAYS win over user-submitted values for the same input key.
    if (config.fields) {
      for (const [inputKey, rawValue] of Object.entries(config.fields)) {
        merged[inputKey] = interpolate(rawValue, canonicalContext);
      }
    }

    const fieldValues: FieldValueRecord[] = [];
    for (const [key, value] of Object.entries(merged)) {
      const match = key.match(INPUT_KEY);
      if (!match) continue;
      fieldValues.push(payloadToFieldValue(Number(match[1]), value));
    }

    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationName: "submitForm",
        query: SUBMIT_FORM_MUTATION,
        variables: { id: config.formId, fieldValues },
      }),
    });
  },

  resolveTarget(config) {
    return resolveEndpoint(config);
  },
};
