import { describe, expect, it } from "vitest";

import { toAccelerator } from "./HotkeyInput";

/** Minimal stand-in for the KeyboardEvent fields `toAccelerator` reads. */
function keydown(
  code: string,
  mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>> = {},
): KeyboardEvent {
  return {
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...mods,
  } as KeyboardEvent;
}

describe("toAccelerator", () => {
  it("builds an accelerator from modifiers plus a key", () => {
    expect(toAccelerator(keydown("KeyM", { ctrlKey: true, altKey: true }))).toBe(
      "Ctrl+Alt+M",
    );
    expect(toAccelerator(keydown("F11", { ctrlKey: true, altKey: true }))).toBe(
      "Ctrl+Alt+F11",
    );
    expect(toAccelerator(keydown("Digit4", { ctrlKey: true }))).toBe("Ctrl+4");
  });

  it("keeps the modifier order Tauri expects", () => {
    const all = keydown("KeyA", {
      metaKey: true,
      shiftKey: true,
      altKey: true,
      ctrlKey: true,
    });
    expect(toAccelerator(all)).toBe("Ctrl+Alt+Shift+Super+A");
  });

  it("rejects a bare key, so a binding cannot swallow plain typing", () => {
    expect(toAccelerator(keydown("KeyM"))).toBeNull();
    expect(toAccelerator(keydown("F11"))).toBeNull();
  });

  it("rejects keys outside the supported set", () => {
    for (const code of ["Space", "Enter", "ArrowUp", "Escape", "F25"]) {
      expect(toAccelerator(keydown(code, { ctrlKey: true }))).toBeNull();
    }
  });

  it("rejects a modifier pressed on its own", () => {
    // The keydown for Ctrl itself reports ctrlKey with code ControlLeft.
    expect(toAccelerator(keydown("ControlLeft", { ctrlKey: true }))).toBeNull();
  });
});
