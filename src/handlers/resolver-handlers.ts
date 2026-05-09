import type { ResolverHandler } from "../types/index.js";

/**
 * Built-in submission-meta handler. Returns a fresh ISO timestamp when
 * referenced as a function resolver in a form config.
 *
 * @example
 *   // form config
 *   "context": {
 *     "submission": {
 *       "resolver": { "type": "function", "handler": "resolveSubmissionMeta" }
 *     }
 *   }
 */
export async function resolveSubmissionMeta() {
  return {
    timestamp: new Date().toISOString(),
  };
}

/**
 * Built-in registry shipped with the package. Consumers can extend this set
 * by passing additional handlers to {@link orchestrateSubmission}.
 */
export const defaultResolverHandlers: Record<string, ResolverHandler> = {
  resolveSubmissionMeta: () => resolveSubmissionMeta(),
};
