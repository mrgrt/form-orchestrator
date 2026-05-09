// ── High-level orchestration ─────────────────────────────────────────────
export { orchestrateSubmission } from "./core/orchestrate.js";
export type { OrchestrateOptions } from "./core/orchestrate.js";

// ── Building blocks (compose your own flows) ─────────────────────────────
export { resolveContext, resolveContextEntity } from "./core/resolvers.js";
export { enrichPayload } from "./core/enrichment.js";
export { applyMetadata } from "./core/context.js";
export { loadFormConfig } from "./core/loadFormConfig.js";

// ── Adapters ─────────────────────────────────────────────────────────────
export { gravityFormsAdapter } from "./adapters/gravityForms.js";
export { restAdapter } from "./adapters/rest.js";
export { defaultAdapters } from "./adapters/index.js";

// ── Resolver handlers ────────────────────────────────────────────────────
export {
  defaultResolverHandlers,
  resolveSubmissionMeta,
} from "./handlers/resolver-handlers.js";

// ── Utilities ────────────────────────────────────────────────────────────
export { getNestedValue, setNestedValue } from "./utils/getNestedValue.js";
export {
  interpolate,
  isSourcePath,
  resolveSourceValue,
} from "./utils/resolveSourceValue.js";

// ── Types ────────────────────────────────────────────────────────────────
export type {
  AdapterConfig,
  AdapterRegistry,
  AdapterSubmitArgs,
  ApiResolver,
  CanonicalEnvelope,
  ContextEntityConfig,
  FormAdapter,
  FormConfig,
  FunctionResolver,
  GravityFormsAdapterConfig,
  ResolutionContext,
  Resolver,
  ResolverHandler,
  ResolverHandlerArgs,
  RestAdapterConfig,
} from "./types/index.js";
