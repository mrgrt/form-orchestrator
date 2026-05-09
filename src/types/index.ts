// ── Resolvers ────────────────────────────────────────────────────────────

export type ApiResolver = {
  type: "api";
  endpoint: string;
  method?: "GET" | "POST";
};

export type FunctionResolver = {
  type: "function";
  handler: string;
};

export type Resolver = ApiResolver | FunctionResolver;

export type ContextEntityConfig = {
  source?: string;
  resolver: Resolver;
};

export type ResolverHandlerArgs = {
  value: unknown;
  context: ResolutionContext;
};

export type ResolverHandler = (
  args: ResolverHandlerArgs,
) => unknown | Promise<unknown>;

// ── Adapter configs ──────────────────────────────────────────────────────

export type GravityFormsAdapterConfig = {
  type: "gravityForms";
  formId: number;
  endpoint?: string;
  /** Map of `input_<id>` ← literal value or `{{path}}` interpolation
   *  resolved against the canonical context. */
  fields?: Record<string, string>;
};

export type RestAdapterConfig = {
  type: "rest";
  endpoint?: string;
  method?: "POST" | "PUT" | "PATCH";
};

export type AdapterConfig = GravityFormsAdapterConfig | RestAdapterConfig;

// ── Form config ──────────────────────────────────────────────────────────

export type FormConfig = {
  adapter: AdapterConfig;
  context?: Record<string, ContextEntityConfig>;
  /** Dotted-path assignments into the canonical context.
   *  Values may be literals or `params.x` / `payload.x` / `context.x` paths. */
  metadata?: Record<string, string>;
};

// ── Runtime envelopes ────────────────────────────────────────────────────

export type ResolutionContext = {
  params: Record<string, unknown>;
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
};

export type CanonicalEnvelope = {
  params: Record<string, unknown>;
  payload: Record<string, unknown>;
};

// ── Adapter contract ─────────────────────────────────────────────────────

export type AdapterSubmitArgs<TConfig extends AdapterConfig = AdapterConfig> = {
  /** User-controlled values decoded by the adapter from the incoming request. */
  payload: Record<string, unknown>;
  /** Untrusted presentation-layer params (e.g. route slug). */
  params: Record<string, unknown>;
  /** Trusted, server-resolved canonical context (resolved entities + metadata). */
  canonicalContext: Record<string, unknown>;
  config: TConfig;
};

/**
 * Adapters isolate transport-format concerns (GraphQL, REST, etc.) from
 * orchestration. They decode incoming HTTP into a canonical {params, payload}
 * envelope, and submit by combining user payload + trusted canonical context
 * into whatever shape the downstream backend expects.
 */
export interface FormAdapter<TConfig extends AdapterConfig = AdapterConfig> {
  decode(req: Request, config: TConfig): Promise<CanonicalEnvelope>;
  submit(args: AdapterSubmitArgs<TConfig>): Promise<Response>;
  resolveTarget(config: TConfig): string | undefined;
}

export type AdapterRegistry = {
  [K in AdapterConfig["type"]]?: FormAdapter<Extract<AdapterConfig, { type: K }>>;
};
