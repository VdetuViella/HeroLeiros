import { describe, expect, it } from "vitest";

import { assignKey, defaultKeymap, keyLabel } from "./keymap";

describe("keymap", () => {
  it("por defecto D F J K para 4 carriles", () => {
    expect(defaultKeymap(4)).toEqual(["KeyD", "KeyF", "KeyJ", "KeyK"]);
    expect(defaultKeymap(2)).toEqual(["KeyF", "KeyJ"]);
  });

  it("intercambia teclas si ya estaban asignadas", () => {
    expect(assignKey(["KeyD", "KeyF", "KeyJ"], 0, "KeyJ")).toEqual(["KeyJ", "KeyF", "KeyD"]);
    expect(assignKey(["KeyD", "KeyF"], 1, "KeyA")).toEqual(["KeyD", "KeyA"]);
  });

  it("muestra etiquetas legibles", () => {
    expect(keyLabel("KeyD")).toBe("D");
    expect(keyLabel("Space")).toBe("Espacio");
    expect(keyLabel("Digit3")).toBe("3");
  });
});
