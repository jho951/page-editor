/**
 * 에디터 화면의 로딩, autosave, 단축키, 종료 시 flush 흐름을 제어합니다.
 */

import { useMemo } from "react";
import { useI18n } from "@app/provider/useI18n.ts";
import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import {
  selectEditor,
  selectEditorBlocks,
  selectEditorErrorMessage,
  selectEditorHasPendingChanges,
  selectEditorLastSavedAt,
  selectEditorSaveState,
  selectEditorSelectedBlockId,
} from "@features/editor/state/editor.selector.ts";
import { selectShortcutPending } from "@features/shortcuts/index.ts";
import { useEditorAutosave } from "@features/editor/ui/block-editor/useEditorAutosave.ts";
import { useEditorDocumentLoad } from "@features/editor/ui/block-editor/useEditorDocumentLoad.ts";
import { useEditorLeaveGuards } from "@features/editor/ui/block-editor/useEditorLeaveGuards.ts";
import { useEditorShortcutBridge } from "@features/editor/ui/block-editor/useEditorShortcutBridge.ts";

function formatStatus(
  saveState: string,
  lastSavedAt: number | null,
  t: (key: "editor.status.saving" | "editor.status.conflict" | "editor.status.error" | "editor.status.dirty" | "editor.status.saved" | "editor.status.local", params?: Record<string, string>) => string,
  formatDateTime: (value: number | string | Date, options?: Intl.DateTimeFormatOptions) => string,
): string {
  if (saveState === "saving") return t("editor.status.saving");
  if (saveState === "conflict") return t("editor.status.conflict");
  if (saveState === "error") return t("editor.status.error");
  if (saveState === "dirty") return t("editor.status.dirty");
  if (saveState === "saved" && lastSavedAt) {
    return t("editor.status.saved", {
      time: formatDateTime(lastSavedAt, {
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }
  return t("editor.status.local");
}

export function useBlockEditorController(documentId: string) {
  const { formatDateTime, t } = useI18n();
  const dispatch = useAppDispatch();
  const editor = useAppSelector(selectEditor);
  const blocks = useAppSelector(selectEditorBlocks);
  const saveState = useAppSelector(selectEditorSaveState);
  const selectedBlockId = useAppSelector(selectEditorSelectedBlockId);
  const lastSavedAt = useAppSelector(selectEditorLastSavedAt);
  const errorMessage = useAppSelector(selectEditorErrorMessage);
  const pendingShortcut = useAppSelector(selectShortcutPending);
  const hasPendingChanges = useAppSelector(selectEditorHasPendingChanges);
  const saveDocument = useEditorAutosave({
    dispatch,
    documentId,
    editor,
    saveState,
  });

  useEditorDocumentLoad({
    dispatch,
    documentId,
    editor,
  });
  useEditorShortcutBridge({
    dispatch,
    pendingShortcut,
    selectedBlockId,
  });
  useEditorLeaveGuards({
    dispatch,
    documentId,
    editor,
    hasPendingChanges,
  });

  const statusText = useMemo(
    () => formatStatus(saveState, lastSavedAt, t, formatDateTime),
    [formatDateTime, lastSavedAt, saveState, t],
  );

  return {
    blocks,
    dispatch,
    errorMessage,
    saveDocument,
    saveState,
    selectedBlockId,
    statusText,
  };
}
