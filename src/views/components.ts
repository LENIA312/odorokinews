export function leadFromBody(body: string, maxLen = 90): string {
  const firstLine = body.split("\n").find((l) => l.trim().length > 0) ?? "";
  return firstLine.length > maxLen ? `${firstLine.slice(0, maxLen)}…` : firstLine;
}
