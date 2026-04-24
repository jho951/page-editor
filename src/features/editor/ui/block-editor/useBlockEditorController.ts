/**
 * 에디터 화면의 로딩, autosave, 단축키, 종료 시 flush 흐름을 제어합니다.
 */

import { useMemo } from "react";
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

function formatStatus(saveState: string, lastSavedAt: number | null): string {
  if (saveState === "saving") return "저장 중...";
  if (saveState === "conflict") return "충돌 발생";
  if (saveState === "error") return "저장 실패";
  if (saveState === "dirty") return "저장 대기 중";
  if (saveState === "saved" && lastSavedAt) {
    return `저장됨 ${new Date(lastSavedAt).toLocaleTimeString()}`;
  }
  return "로컬 편집 중";
}

export function useBlockEditorController(documentId: string) {
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

  const statusText = useMemo(() => formatStatus(saveState, lastSavedAt), [saveState, lastSavedAt]);

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
