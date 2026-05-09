import { orchestrateSubmission } from "form-orchestrator";

/**
 * One-line BFF route handler. All orchestration — config loading, adapter
 * dispatch, context resolution, metadata application, payload enrichment,
 * submission, and response passthrough — lives inside `orchestrateSubmission`.
 *
 * Form configs live at `<cwd>/src/configs/forms/<formKey>.json` by default.
 * Pass `configDir` to override.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ formKey: string }> },
) {
  const { formKey } = await params;
  return orchestrateSubmission({ formKey, request });
}
