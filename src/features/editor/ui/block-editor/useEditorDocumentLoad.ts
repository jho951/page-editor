import { useEffect } from "react";

import type { AppDispatch } from "@app/store/store.ts";
import { selectEditor } from "@features/editor/state/editor.selector.ts";
import { loadEditorDocument } from "@features/editor/state/editor.slice.ts";

type EditorSliceState = ReturnType<typeof selectEditor>;

interface UseEditorDocumentLoadOptions {
  dispatch: AppDispatch;
  documentId: string;
  editor: EditorSliceState;
}

function useEditorDocumentLoad({
  dispatch,
  documentId,
  editor,
}: UseEditorDocumentLoadOptions): void {
  useEffect(() => {
    if (editor.document.currentDocumentId === documentId && editor.loaded) return;
    void dispatch(loadEditorDocument(documentId));
  }, [dispatch, documentId, editor.document.currentDocumentId, editor.loaded]);
}

export { useEditorDocumentLoad };
