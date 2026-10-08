export type Status = "GREEN" | "YELLOW" | "RED";

export type ItemResult = {
  status: Status;
  label: "OK" | "EXCESS" | "SHORTAGE" | "UNCOUNTED";
};

export function evaluateItem(
  actual: number | null,
  expected: number,
): ItemResult {
  if (actual === null) return { status: "RED", label: "UNCOUNTED" };
  if (actual < expected) return { status: "RED", label: "SHORTAGE" };
  if (actual > expected) return { status: "YELLOW", label: "EXCESS" };
  return { status: "GREEN", label: "OK" };
}

export function wastagePct(
  actualYds: number,
  expectedYds: number,
): number | null {
  if (!(expectedYds > 0)) return null;
  return Math.round(((actualYds - expectedYds) / expectedYds) * 10000) / 100;
}
