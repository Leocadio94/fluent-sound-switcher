export type AutostartAction = "enable" | "remember" | "none";

/**
 * What to do about "start with Windows" when the app opens.
 *
 * Running the installer over an existing install removes the Run entry (the old
 * uninstaller does it), so the OS state alone cannot say whether the user wanted
 * it. The stored preference can.
 * @see docs/autostart-e-reinstalacao.md
 */
export function autostartAction(
  preferred: boolean | null,
  registered: boolean,
): AutostartAction {
  if (registered) return preferred === true ? "none" : "remember";
  return preferred === true ? "enable" : "none";
}
