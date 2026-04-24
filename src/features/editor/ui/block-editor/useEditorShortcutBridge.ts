import { useEffect } from "react";

import type { AppDispatch } from "@app/store/store.ts";
import { shortcutsActions, selectShortcutPending } from "@features/shortcuts/index.ts";
import { editorActions } from "@features/editor/state/editor.slice.ts";

const BLOCK_SHORTCUT_COMMANDS = new Set([
  "undo-edit",
  "redo-edit",
  "turn-into-text",
  "turn-into-heading-1",
  "turn-into-heading-2",
  "turn-into-heading-3",
  "duplicate-block",
  "move-block-up",
  "move-block-down",
  "format-bold",
  "format-italic",
  "format-underline",
  "format-strikethrough",
  "apply-last-color",
]);

const EDITOR_SHORTCUT_COMMANDS = new Set([
  ...BLOCK_SHORTCUT_COMMANDS,
  "select-current-block",
  "clear-block-selection",
  "edit-selected-block",
  "open-block-menu",
  "modify-current-block",
]);

function isEditorShortcutTarget(): boolean {
  if (typeof document === "undefined") return false;

  const activeElement = document.activeElement;
  return activeElement instanceof HTMLElement && activeElement.dataset.editorBlockInput === "true";
}

type PendingShortcut = ReturnType<typeof selectShortcutPending>;

interface UseEditorShortcutBridgeOptions {
  dispatch: AppDispatch;
  pendingShortcut: PendingShortcut;
  selectedBlockId: string | null;
}

function useEditorShortcutBridge({
  dispatch,
  pendingShortcut,
  selectedBlockId,
}: UseEditorShortcutBridgeOptions): void {
  useEffect(() => {
    if (!pendingShortcut) return;

    if (EDITOR_SHORTCUT_COMMANDS.has(pendingShortcut.command) && !isEditorShortcutTarget()) {
      dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
      return;
    }

    if (BLOCK_SHORTCUT_COMMANDS.has(pendingShortcut.command)) {
      dispatch(editorActions.consumeShortcutCommand({ command: pendingShortcut.command }));
      dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
      return;
    }

    if (pendingShortcut.command === "new-page") {
      dispatch(editorActions.insertBlockAfter({ afterBlockId: selectedBlockId }));
      dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
    }
  }, [dispatch, pendingShortcut, selectedBlockId]);
}

export { useEditorShortcutBridge };
