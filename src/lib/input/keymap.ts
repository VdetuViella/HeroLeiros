/** Teclas por defecto según el número de carriles (valores de `KeyboardEvent.code`). */
export const DEFAULT_KEYMAPS: Record<number, string[]> = {
  1: ["KeyF"],
  2: ["KeyF", "KeyJ"],
  3: ["KeyF", "KeyJ", "KeyK"],
  4: ["KeyD", "KeyF", "KeyJ", "KeyK"],
};

export function defaultKeymap(laneCount: number): string[] {
  return DEFAULT_KEYMAPS[laneCount] ?? DEFAULT_KEYMAPS[4].slice(0, laneCount);
}

const NAMED_KEYS: Record<string, string> = {
  Space: "Espacio",
  Semicolon: "Ñ",
  Quote: "´",
  Comma: ",",
  Period: ".",
  Slash: "-",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Enter: "Intro",
  ShiftLeft: "Mayús izq.",
  ShiftRight: "Mayús der.",
};

export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return NAMED_KEYS[code] ?? code;
}

/** Teclas que no se pueden asignar a carriles porque controlan la partida. */
export const RESERVED_KEYS = new Set(["Escape", "Tab"]);

/** Asigna `code` al carril `lane`, intercambiando si ya estaba en otro carril. */
export function assignKey(keymap: string[], lane: number, code: string): string[] {
  const next = [...keymap];
  const existing = next.indexOf(code);
  if (existing !== -1 && existing !== lane) next[existing] = next[lane];
  next[lane] = code;
  return next;
}
