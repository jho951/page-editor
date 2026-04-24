import { useEffect, useRef } from "react";

import type { AppDispatch } from "@app/store/store.ts";
import { selectEditor } from "@features/editor/state/editor.selector.ts";
import {
  flushEditorTransactions,
  prepareEditorTransactionOperations,
} from "@features/editor/state/editor.slice.ts";
import { editorTransactionsApi } from "@features/editor/api/transactions.ts";

type EditorSliceState = ReturnType<typeof selectEditor>;

interface UseEditorLeaveGuardsOptions {
  dispatch: AppDispatch;
  documentId: string;
  editor: EditorSliceState;
  hasPendingChanges: boolean;
}

function useEditorLeaveGuards({
  dispatch,
  documentId,
  editor,
  hasPendingChanges,
}: UseEditorLeaveGuardsOptions): void {
  const latestEditorRef = useRef(editor);

  useEffect(() => {
    latestEditorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const currentEditor = latestEditorRef.current;
      if (!hasPendingChanges) return;
      if (
        currentEditor.document.currentDocumentId === documentId &&
        !currentEditor.inFlight &&
        currentEditor.queue.ops.length > 0
      ) {
        editorTransactionsApi.postTransactionsKeepalive(documentId, {
          clientId: "web-editor",
          batchId: `leave-${Date.now()}`,
          documentVersion: currentEditor.document.byId[documentId]?.version ?? 0,
          operations: prepareEditorTransactionOperations(currentEditor, currentEditor.queue.ops),
        });
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [documentId, hasPendingChanges]);

  useEffect(() => {
    const onPageHide = () => {
      const currentEditor = latestEditorRef.current;
      if (currentEditor.document.currentDocumentId !== documentId) return;
      if (currentEditor.inFlight || currentEditor.queue.ops.length === 0) return;
      editorTransactionsApi.postTransactionsKeepalive(documentId, {
        clientId: "web-editor",
        batchId: `pagehide-${Date.now()}`,
        documentVersion: currentEditor.document.byId[documentId]?.version ?? 0,
        operations: prepareEditorTransactionOperations(currentEditor, currentEditor.queue.ops),
      });
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [documentId]);

  useEffect(() => {
    return () => {
      const currentEditor = latestEditorRef.current;
      if (currentEditor.document.currentDocumentId !== documentId) return;
      if (currentEditor.inFlight || currentEditor.queue.ops.length === 0) return;
      void dispatch(flushEditorTransactions());
    };
  }, [dispatch, documentId]);
}

export { useEditorLeaveGuards };
