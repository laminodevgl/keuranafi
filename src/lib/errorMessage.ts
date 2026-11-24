export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) {
    return String(error);
  }

  const record = error as Record<string, unknown>;
  const parts = ["message", "details", "hint", "code", "statusCode"]
    .map((key) => {
      const value = record[key];
      return typeof value === "string" || typeof value === "number"
        ? `${key}: ${value}`
        : "";
    })
    .filter(Boolean);

  if (parts.length) return parts.join(" · ");

  try {
    return JSON.stringify(error);
  } catch {
    return "Erreur inconnue (détails indisponibles)";
  }
}
