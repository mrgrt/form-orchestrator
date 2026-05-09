import { defaultAdapters } from "../adapters/index.js";
import { defaultResolverHandlers } from "../handlers/resolver-handlers.js";
import type {
  AdapterConfig,
  AdapterRegistry,
  FormAdapter,
  ResolutionContext,
  ResolverHandler,
} from "../types/index.js";
import { applyMetadata } from "./context.js";
import {
  logCanonicalContext,
  logError,
  logForward,
  logRequest,
} from "./debug.js";
import { loadFormConfig } from "./loadFormConfig.js";
import { resolveContext } from "./resolvers.js";

export type OrchestrateOptions = {
  /** Form key — used to look up `<configDir>/<formKey>.json`. */
  formKey: string;
  /** The incoming HTTP request from the Next.js Route Handler. */
  request: Request;
  /** Override directory for form config JSON files. */
  configDir?: string;
  /** Additional / overriding function-resolver handlers. */
  resolvers?: Record<string, ResolverHandler>;
  /** Additional / overriding adapter registry. */
  adapters?: AdapterRegistry;
};

function getAdapter(
  type: AdapterConfig["type"],
  registry: AdapterRegistry,
): FormAdapter | undefined {
  return registry[type] as FormAdapter | undefined;
}

/**
 * The full submission lifecycle, end-to-end:
 *
 *   1. Load form config by `formKey`
 *   2. Look up the configured adapter
 *   3. Adapter decodes the incoming HTTP request → `{ params, payload }`
 *   4. Resolve every entity in `config.context` (API / function resolvers)
 *   5. Apply `config.metadata` overlays into the canonical context
 *   6. Adapter submits user payload + canonical context → downstream backend
 *   7. Pass through the response status + body to the caller
 *
 * The route handler stays a one-liner; everything else is configuration.
 */
export async function orchestrateSubmission({
  formKey,
  request,
  configDir,
  resolvers,
  adapters,
}: OrchestrateOptions): Promise<Response> {
  const adapterRegistry: AdapterRegistry = { ...defaultAdapters, ...adapters };
  const handlerRegistry: Record<string, ResolverHandler> = {
    ...defaultResolverHandlers,
    ...resolvers,
  };

  const config = await loadFormConfig(formKey, configDir);
  if (!config) {
    return Response.json(
      { error: `Form configuration not found for key "${formKey}".` },
      { status: 404 },
    );
  }

  const adapter = getAdapter(config.adapter.type, adapterRegistry);
  if (!adapter) {
    return Response.json(
      { error: `No adapter registered for type "${config.adapter.type}".` },
      { status: 500 },
    );
  }

  let envelope;
  try {
    envelope = await adapter.decode(request, config.adapter);
  } catch (err) {
    logError("decode", err);
    return Response.json(
      { error: "Failed to decode incoming request body." },
      { status: 400 },
    );
  }

  const ctx: ResolutionContext = {
    params: envelope.params,
    payload: envelope.payload,
    context: {},
  };

  logRequest(formKey, ctx);

  let canonicalContext: Record<string, unknown>;
  try {
    canonicalContext = await resolveContext(
      config.context,
      ctx,
      handlerRegistry,
    );
  } catch (err) {
    logError("resolveContext", err);
    return Response.json(
      { error: "Failed to resolve form context." },
      { status: 500 },
    );
  }

  applyMetadata(canonicalContext, config.metadata, {
    ...ctx,
    context: canonicalContext,
  });

  logCanonicalContext(canonicalContext);

  const start = Date.now();
  let upstream: Response;
  try {
    upstream = await adapter.submit({
      payload: envelope.payload,
      params: envelope.params,
      canonicalContext,
      config: config.adapter,
    });
  } catch (err) {
    logError("submit", err);
    return Response.json(
      { error: "Form submission failed." },
      { status: 502 },
    );
  }

  logForward(
    config.adapter.type,
    adapter.resolveTarget(config.adapter),
    upstream.status,
    Date.now() - start,
  );

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
