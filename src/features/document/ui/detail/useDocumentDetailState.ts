import { useCallback, useEffect, useState } from "react";

import { pagesApi } from "@features/layout/api/pages.ts";
import type { HttpError } from "@shared/api/client.types.ts";
import type {
  DocumentDetailState,
  DocumentTitleSaveState,
} from "@features/document/ui/detail/detail.types.ts";
import {
  buildDocumentState,
  normalizeDocumentTitle,
} from "@features/document/ui/detail/detail.utils.ts";

interface UseDocumentDetailStateOptions {
  documentId: string | null;
  onTitleSync: (documentId: string, title: string, createdAt?: string) => void;
}

interface UseDocumentDetailStateResult {
  documentState: DocumentDetailState | null;
  error: string | null;
  loading: boolean;
  saveDocumentTitle: () => Promise<void>;
  titleDraft: string;
  titleError: string | null;
  titleSaveState: DocumentTitleSaveState;
  updateTitleDraft: (nextTitle: string) => void;
}

function useDocumentDetailState({
  documentId,
  onTitleSync,
}: UseDocumentDetailStateOptions): UseDocumentDetailStateResult {
  const [documentState, setDocumentState] = useState<DocumentDetailState | null>(null);
  const [titleDraft, setTitleDraft] = useState<string>("");
  const [titleSaveState, setTitleSaveState] = useState<DocumentTitleSaveState>("idle");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(documentId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setDocumentState(null);
      setTitleDraft("");
      setTitleSaveState("idle");
      setTitleError(null);
      setLoading(false);
      setError("문서 ID가 없습니다.");
      return;
    }

    let cancelled = false;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await pagesApi.getPage(documentId);
        if (cancelled) return;

        const nextDocument = buildDocumentState(
          response.id,
          response.title,
          response.version,
          response.createdAt,
        );
        setDocumentState(nextDocument);
        setTitleDraft(nextDocument.title);
        setTitleSaveState("idle");
        setTitleError(null);
        onTitleSync(nextDocument.id, nextDocument.title, nextDocument.createdAt);
      } catch (loadError) {
        if (cancelled) return;

        setError(loadError instanceof Error ? loadError.message : "문서를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [documentId, onTitleSync]);

  useEffect(() => {
    if (titleSaveState !== "saved") return;

    const timer = window.setTimeout(() => {
      setTitleSaveState((current) => (current === "saved" ? "idle" : current));
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [titleSaveState]);

  const updateTitleDraft = useCallback((nextTitle: string) => {
    setTitleDraft(nextTitle);
    if (titleSaveState !== "idle") setTitleSaveState("idle");
    if (titleError) setTitleError(null);
  }, [titleError, titleSaveState]);

  const saveDocumentTitle = useCallback(async (): Promise<void> => {
    if (!documentId || !documentState) return;
    if (titleSaveState === "saving") return;

    const nextTitle = normalizeDocumentTitle(titleDraft);
    setTitleDraft(nextTitle);
    setTitleError(null);

    if (nextTitle === documentState.title) {
      setTitleSaveState("saved");
      return;
    }

    setTitleSaveState("saving");

    const updateWithLatestVersion = async (): Promise<DocumentDetailState> => {
      const latestPage = await pagesApi.getPage(documentId);
      const latestDocument = buildDocumentState(
        documentId,
        latestPage.title,
        latestPage.version,
        latestPage.createdAt,
      );

      if (latestDocument.title === nextTitle) return latestDocument;

      try {
        const updatedPage = await pagesApi.updatePage(documentId, {
          title: nextTitle,
          version: latestDocument.version,
        });
        return buildDocumentState(
          documentId,
          updatedPage.title,
          updatedPage.version,
          updatedPage.createdAt ?? latestDocument.createdAt,
        );
      } catch (updateError) {
        const httpError = updateError as HttpError;
        if (httpError.status !== 409) throw updateError;

        const retriedPage = await pagesApi.getPage(documentId);
        const retriedDocument = buildDocumentState(
          documentId,
          retriedPage.title,
          retriedPage.version,
          retriedPage.createdAt,
        );

        if (retriedDocument.title === nextTitle) return retriedDocument;

        const updatedPage = await pagesApi.updatePage(documentId, {
          title: nextTitle,
          version: retriedDocument.version,
        });
        return buildDocumentState(
          documentId,
          updatedPage.title,
          updatedPage.version,
          updatedPage.createdAt ?? retriedDocument.createdAt,
        );
      }
    };

    try {
      const updatedDocument = await updateWithLatestVersion();
      setDocumentState(updatedDocument);
      setTitleDraft(updatedDocument.title);
      setTitleSaveState("saved");
      onTitleSync(updatedDocument.id, updatedDocument.title, updatedDocument.createdAt);
    } catch (saveError) {
      setTitleSaveState("error");
      setTitleError(saveError instanceof Error ? saveError.message : "제목을 저장하지 못했습니다.");
    }
  }, [documentId, documentState, onTitleSync, titleDraft, titleSaveState]);

  return {
    documentState,
    error,
    loading,
    saveDocumentTitle,
    titleDraft,
    titleError,
    titleSaveState,
    updateTitleDraft,
  };
}

export { useDocumentDetailState };
