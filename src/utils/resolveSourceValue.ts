import type { ResolutionContext } from "../types/index.js";
import { getNestedValue } from "./getNestedValue.js";

const SOURCE_PREFIXES = ["params.", "payload.", "context."] as const;
const INTERPOLATION_PATTERN = /^\{\{\s*([^{}]+?)\s*\}\}$/;

/**
 * Returns true if `value` begins with one of the resolution-context source
 * prefixes (`params.`, `payload.`, `context.`).
 */
export function isSourcePath(value: string): boolean {
  return SOURCE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/**
 * Resolve a string config value against a {@link ResolutionContext}.
 *   - "params.slug"        → looks up params.slug in the context
 *   - "context.trainer.id" → looks up context.trainer.id
 *   - "anything else"      → returned as a literal
 *
 * Used by `applyMetadata` and `resolveContextEntity` for source-bound values.
 */
export function resolveSourceValue(
  value: string,
  ctx: ResolutionContext,
): unknown {
  return isSourcePath(value) ? getNestedValue(ctx, value) : value;
}

/**
 * Resolve an explicit interpolation expression against a source object.
 *   - "{{trainer.id}}" → getNestedValue(source, "trainer.id")
 *   - "anything else"  → returned unchanged as a literal
 *
 * Used by adapter field maps so plain strings stay literal and only
 * `{{path}}` references reach into the canonical context.
 */
export function interpolate(value: string, source: unknown): unknown {
  const match = value.match(INTERPOLATION_PATTERN);
  if (match) return getNestedValue(source, match[1]);
  return value;
}
