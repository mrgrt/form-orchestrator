import type {
  ApiResolver,
  ContextEntityConfig,
  FunctionResolver,
  ResolutionContext,
  ResolverHandler,
} from "../types/index.js";
import { resolveSourceValue } from "../utils/resolveSourceValue.js";

const apiBaseUrl = (process.env.API_BASE_URL ?? "").replace(/\/$/, "");

function buildResolverUrl(endpoint: string, value: unknown): string {
  const stringValue = value === undefined || value === null ? "" : String(value);
  const withValue = endpoint.replace("{value}", encodeURIComponent(stringValue));
  return /^https?:\/\//i.test(withValue) ? withValue : `${apiBaseUrl}${withValue}`;
}

async function runApiResolver(
  resolver: ApiResolver,
  value: unknown,
): Promise<unknown> {
  const url = buildResolverUrl(resolver.endpoint, value);
  const res = await fetch(url, { method: resolver.method ?? "GET" });
  if (!res.ok) {
    throw new Error(`API resolver failed: ${url} responded ${res.status}`);
  }
  return res.json();
}

async function runFunctionResolver(
  resolver: FunctionResolver,
  value: unknown,
  ctx: ResolutionContext,
  handlers: Record<string, ResolverHandler>,
): Promise<unknown> {
  const handler = handlers[resolver.handler];
  if (!handler) {
    throw new Error(`Unknown resolver handler: "${resolver.handler}"`);
  }
  return handler({ value, context: ctx });
}

/**
 * Resolve a single context entity by running its configured resolver.
 */
export async function resolveContextEntity(
  config: ContextEntityConfig,
  ctx: ResolutionContext,
  handlers: Record<string, ResolverHandler>,
): Promise<unknown> {
  const value = config.source ? resolveSourceValue(config.source, ctx) : undefined;

  switch (config.resolver.type) {
    case "api":
      return runApiResolver(config.resolver, value);
    case "function":
      return runFunctionResolver(config.resolver, value, ctx, handlers);
    default: {
      const exhaustive: never = config.resolver;
      throw new Error(`Unsupported resolver type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Resolve all configured context entities sequentially so later entities
 * can reference earlier ones via `context.<previousKey>`.
 */
export async function resolveContext(
  contextConfig: Record<string, ContextEntityConfig> | undefined,
  ctx: ResolutionContext,
  handlers: Record<string, ResolverHandler>,
): Promise<Record<string, unknown>> {
  if (!contextConfig) return {};

  const resolved: Record<string, unknown> = {};
  for (const [key, entityConfig] of Object.entries(contextConfig)) {
    resolved[key] = await resolveContextEntity(
      entityConfig,
      { ...ctx, context: resolved },
      handlers,
    );
  }
  return resolved;
}
