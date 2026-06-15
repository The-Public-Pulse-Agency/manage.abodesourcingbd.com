export function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function slugCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
