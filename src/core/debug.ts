import type { ResolutionContext } from "../types/index.js";

const PREFIX = "[form-orchestrator]";

function isEnabled(): boolean {
  if (process.env.FORM_ORCHESTRATOR_DEBUG === "1") return true;
  if (process.env.FORM_ORCHESTRATOR_DEBUG === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function fmt(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

export function logRequest(formKey: string, ctx: ResolutionContext): void {
  if (!isEnabled()) return;
  console.log(`\n${PREFIX} ── form: ${formKey} ──────────────`);
  console.log(`${PREFIX} params:  ${fmt(ctx.params)}`);
  console.log(`${PREFIX} payload: ${fmt(ctx.payload)}`);
}

export function logCanonicalContext(canonical: Record<string, unknown>): void {
  if (!isEnabled()) return;
  const keys = Object.keys(canonical);
  if (keys.length === 0) {
    console.log(`${PREFIX} canonical: (empty)`);
    return;
  }
  console.log(`${PREFIX} canonical context:`);
  const width = Math.max(...keys.map((k) => k.length));
  for (const key of keys) {
    console.log(`${PREFIX}   ${pad(key, width)} = ${fmt(canonical[key])}`);
  }
}

export function logForward(
  adapterType: string,
  endpoint: string | undefined,
  status: number,
  ms: number,
): void {
  if (!isEnabled()) return;
  const target = endpoint ?? "(unset)";
  console.log(
    `${PREFIX} forwarded via ${adapterType} → ${target} → ${status} (${ms}ms)\n`,
  );
}

export function logError(stage: string, err: unknown): void {
  if (!isEnabled()) return;
  const message = err instanceof Error ? err.message : String(err);
  console.log(`${PREFIX} error during "${stage}": ${message}\n`);
}
