export type PinMap = Record<string, string>;

export function parsePartnerPins(raw: string | undefined): PinMap {
  if (!raw) return {};
  const map: PinMap = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const store = trimmed.slice(0, colon).trim();
    const pin = trimmed.slice(colon + 1).trim();
    if (!store || !pin) continue;
    map[pin] = store;
  }
  return map;
}

export function storeForPin(pins: PinMap, pin: string): string | null {
  if (!pin) return null;
  return pins[pin] ?? null;
}
