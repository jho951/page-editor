const EDITOR_DEBUG_ENABLED =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEBUG_EDITOR === "true";

function logEditorDebug(
  label: string,
  detailsFactory?: () => Record<string, unknown>,
): void {
  if (!EDITOR_DEBUG_ENABLED) return;
  console.log(`[EDITOR][${label}]`, detailsFactory ? detailsFactory() : undefined);
}

export { EDITOR_DEBUG_ENABLED, logEditorDebug };
