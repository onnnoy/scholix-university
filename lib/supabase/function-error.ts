import { FunctionsHttpError } from "@supabase/supabase-js";

type FunctionErrorPayload = {
  error?: unknown;
  message?: unknown;
  code?: unknown;
  stage?: unknown;
};

export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context;
    let payload: FunctionErrorPayload | null = null;

    try {
      payload = (await response.clone().json()) as FunctionErrorPayload;
    } catch {
      // Some edge/proxy failures return text or an empty response body.
    }

    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : null;
    const code = typeof payload?.code === "string" ? payload.code : null;
    const stage = typeof payload?.stage === "string" ? payload.stage : null;
    const details = [message, code ? `code: ${code}` : null, stage ? `stage: ${stage}` : null]
      .filter(Boolean)
      .join(" — ");

    return details
      ? `${details} (HTTP ${response.status})`
      : `Edge Function request failed (HTTP ${response.status}). ${error.message}`;
  }

  return error instanceof Error ? error.message : "The request failed unexpectedly.";
}
