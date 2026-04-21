/**
 * 에디터 화면의 로딩, autosave, 단축키, 종료 시 flush 흐름을 제어합니다.
 */

import { useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import {
  editorActions,
  flushEditorTransactions,
  loadEditorDocument,
  prepareEditorTransactionOperations,
} from "@features/editor/state/editor.slice.ts";
import {
  selectEditor,
  selectEditorBlocks,
  selectEditorErrorMessage,
  selectEditorHasPendingChanges,
  selectEditorLastSavedAt,
  selectEditorSaveState,
  selectEditorSelectedBlockId,
} from "@features/editor/state/editor.selector.ts";
import { editorTransactionsApi } from "@features/editor/api/transactions.ts";
import { shortcutsActions, selectShortcutPending } from "@features/shortcuts/index.ts";

/**
 * AUTOSAVE MS 상수입니다.
 */
const AUTOSAVE_MS = 2000;

/**
 * BLOCK SHORTCUT COMMANDS 상수입니다.
 */
const BLOCK_SHORTCUT_COMMANDS = new Set([
  "turn-into-text",
  "turn-into-heading-1",
  "turn-into-heading-2",
  "turn-into-heading-3",
  "turn-into-bulleted-list",
  "turn-into-numbered-list",
  "turn-into-to-do",
  "turn-into-toggle-list",
  "turn-into-code-block",
  "duplicate-block",
  "move-block-up",
  "move-block-down",
  "format-bold",
  "format-italic",
  "format-underline",
  "format-strikethrough",
]);

/**
 * 저장 상태를 사용자용 문구로 변환합니다.
 *
 * @param saveState saveState 값입니다.
 * @param lastSavedAt lastSavedAt 값입니다.
 * @returns 문자열 결과를 반환합니다.
 */
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

/**
 * 에디터 로딩, autosave, 단축키 흐름을 묶는 컨트롤러 훅입니다.
 *
 * @param documentId 대상 문서 ID입니다.
 * @returns 화면 제어에 필요한 상태와 핸들러 객체를 반환합니다.
 */
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

  const latestEditorRef = useRef(editor);
  const saveStateRef = useRef(saveState);
  const saveTimerRef = useRef<number | null>(null);
  const pendingForceSaveRef = useRef(false);

  useEffect(() => {
    latestEditorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    if (saveStateRef.current === "saving") return;
    if (!pendingForceSaveRef.current) return;

    pendingForceSaveRef.current = false;
    requestSave(true);
  }, [saveState]);

  useEffect(() => {
    if (editor.document.currentDocumentId === documentId && editor.loaded) return;
    void dispatch(loadEditorDocument(documentId));
  }, [dispatch, documentId, editor.document.currentDocumentId, editor.loaded]);

  useEffect(() => {
    if (saveState !== "dirty") return;

    const timer = window.setInterval(() => {
      if (saveStateRef.current !== "dirty") return;
      if (latestEditorRef.current.inFlight) return;
      void dispatch(flushEditorTransactions());
    }, AUTOSAVE_MS);
    dispatch(editorActions.setAutosaveScheduledAt(Date.now() + AUTOSAVE_MS));
    return () => window.clearInterval(timer);
  }, [dispatch, saveState]);

  useEffect(() => {
    if (!pendingShortcut) return;

    if (pendingShortcut.command === "save-page") {
      console.log("[EDITOR][save-page]", {
        shortcutId: pendingShortcut.id,
        command: pendingShortcut.command,
        saveState: saveStateRef.current,
      });
      requestSave(true);
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

  useEffect(() => {

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingChanges) return;
      if (editor.document.currentDocumentId === documentId && !editor.inFlight && editor.queue.ops.length > 0) {
        editorTransactionsApi.postTransactionsKeepalive(documentId, {
          clientId: "web-editor",
          batchId: `leave-${Date.now()}`,
          documentVersion: editor.document.byId[documentId]?.version ?? 0,
          operations: prepareEditorTransactionOperations(editor, editor.queue.ops),
        });
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [documentId, editor.document.currentDocumentId, editor.inFlight, editor.queue.ops, hasPendingChanges]);

  useEffect(() => {

    const onPageHide = () => {
      if (editor.document.currentDocumentId !== documentId) return;
      if (editor.inFlight || editor.queue.ops.length === 0) return;
      editorTransactionsApi.postTransactionsKeepalive(documentId, {
        clientId: "web-editor",
        batchId: `pagehide-${Date.now()}`,
        documentVersion: editor.document.byId[documentId]?.version ?? 0,
        operations: prepareEditorTransactionOperations(editor, editor.queue.ops),
      });
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [documentId, editor.document.currentDocumentId, editor.inFlight, editor.queue.ops]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const current = latestEditorRef.current;
      if (current.document.currentDocumentId !== documentId) return;
      if (current.inFlight || current.queue.ops.length === 0) return;
      void dispatch(flushEditorTransactions());
    };
  }, [dispatch, documentId]);

  const statusText = useMemo(() => formatStatus(saveState, lastSavedAt), [saveState, lastSavedAt]);
  function requestSave(force = false): void {
    if (saveStateRef.current === "saving") {
      if (force) {
        pendingForceSaveRef.current = true;
        console.log("[EDITOR][request-save-deferred]", {
          force,
          saveState: saveStateRef.current,
          currentDocumentId: latestEditorRef.current.document.currentDocumentId,
          queueLength: latestEditorRef.current.queue.ops.length,
          inFlight: latestEditorRef.current.inFlight,
        });
      }
      return;
    }
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      if (saveStateRef.current === "saving") return;
      console.log("[EDITOR][request-save]", {
        force,
        saveState: saveStateRef.current,
        currentDocumentId: latestEditorRef.current.document.currentDocumentId,
        queueLength: latestEditorRef.current.queue.ops.length,
        inFlight: latestEditorRef.current.inFlight,
      });
      void dispatch(flushEditorTransactions(force ? { force: true } : undefined));
    }, 0);
  }

  return {
    blocks,
    dispatch,
    errorMessage,
    saveState,
    selectedBlockId,
    saveDocument: requestSave,
    statusText,
  };
}
