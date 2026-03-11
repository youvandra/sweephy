export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message || "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") return String(err);
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.length > 0) return maybeMessage;
    try {
      const str = JSON.stringify(err);
      if (str !== "{}") return str;
    } catch {
      // ignore
    }
  }
  return "Unknown error";
}

