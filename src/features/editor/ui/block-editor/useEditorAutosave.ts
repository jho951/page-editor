import { useCallback, useEffect, useRef } from "react";

import type { AppDispatch } from "@app/store/store.ts";
import {
  editorActions,
  flushEditorTransactions,
} from "@features/editor/state/editor.slice.ts";
import {
  selectEditor,
  selectEditorSaveState,
} from "@features/editor/state/editor.selector.ts";

const AUTOSAVE_MS = 2000;

type EditorSliceState = ReturnType<typeof selectEditor>;
type EditorSaveState = ReturnType<typeof selectEditorSaveState>;

interface UseEditorAutosaveOptions {
  dispatch: AppDispatch;
  documentId: string;
  editor: EditorSliceState;
  saveState: EditorSaveState;
}

function useEditorAutosave({
  dispatch,
  documentId,
  editor,
  saveState,
}: UseEditorAutosaveOptions): (force?: boolean) => void {
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

  const requestSave = useCallback(
    (force = false): void => {
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
    },
    [dispatch],
  );

  useEffect(() => {
    if (saveStateRef.current === "saving") return;
    if (!pendingForceSaveRef.current) return;

    pendingForceSaveRef.current = false;
    requestSave(true);
  }, [requestSave, saveState]);

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

  return requestSave;
}

export { useEditorAutosave };
