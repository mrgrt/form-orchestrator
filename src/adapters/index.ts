import type { AdapterRegistry } from "../types/index.js";
import { gravityFormsAdapter } from "./gravityForms.js";
import { restAdapter } from "./rest.js";

/**
 * Built-in adapter registry shipped with the package. Consumers can extend
 * this set by passing additional adapters to `orchestrateSubmission`.
 */
export const defaultAdapters: AdapterRegistry = {
  gravityForms: gravityFormsAdapter,
  rest: restAdapter,
};
