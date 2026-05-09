import type { ResolutionContext } from "../types/index.js";
import { setNestedValue } from "../utils/getNestedValue.js";
import { resolveSourceValue } from "../utils/resolveSourceValue.js";

/**
 * Apply metadata declarations into the canonical context using dotted paths.
 * Values may be literals or `params.x` / `payload.x` / `context.x` references
 * (see {@link resolveSourceValue}). Mutates `canonical` in place.
 *
 * @example
 *   const canonical = { trainer: { id: 88 } };
 *   applyMetadata(canonical, { "submission.source": "public_form" }, ctx);
 *   // canonical = { trainer: { id: 88 }, submission: { source: "public_form" } }
 */
export function applyMetadata(
  canonical: Record<string, unknown>,
  metadata: Record<string, string> | undefined,
  ctx: ResolutionContext,
): void {
  if (!metadata) return;
  for (const [path, source] of Object.entries(metadata)) {
    setNestedValue(canonical, path, resolveSourceValue(source, ctx));
  }
}
