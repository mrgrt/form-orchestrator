/**
 * Read a deep value from an object using a dotted path.
 * Returns `undefined` when any segment is missing.
 *
 * @example
 *   getNestedValue({ trainer: { id: 88 } }, "trainer.id") // → 88
 *   getNestedValue({}, "missing.path")                    // → undefined
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return undefined;

  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Write a deep value into an object using a dotted path. Mutates `obj`.
 * Intermediate non-object segments are replaced with empty objects.
 *
 * @example
 *   const o = {};
 *   setNestedValue(o, "submission.source", "public_form");
 *   // o === { submission: { source: "public_form" } }
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = cursor[key];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}
