import { interpolate } from "../utils/resolveSourceValue.js";

/**
 * Apply an interpolation map (key → "{{path}}" or literal) against a source
 * object (typically the canonical context). Each key in the map receives its
 * resolved value; plain strings are passed through as literals.
 *
 * Returns a new object — the input `payload` is not mutated.
 *
 * @example
 *   enrichPayload(
 *     { input_1: "Hello" },
 *     { input_6: "{{trainer.id}}", input_8: "public_form" },
 *     { trainer: { id: 88 } },
 *   );
 *   // → { input_1: "Hello", input_6: 88, input_8: "public_form" }
 */
export function enrichPayload(
  payload: Record<string, unknown>,
  fieldMap: Record<string, string> | undefined,
  source: Record<string, unknown>,
): Record<string, unknown> {
  if (!fieldMap) return { ...payload };
  const enriched: Record<string, unknown> = { ...payload };
  for (const [key, raw] of Object.entries(fieldMap)) {
    enriched[key] = interpolate(raw, source);
  }
  return enriched;
}
