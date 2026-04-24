/**
 * 문서 상세 화면의 상단 정보와 에디터 영역을 구성합니다.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Icon } from "@jho951/ui-components";

import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import { BlockEditor } from "@features/editor/index.ts";
import { documentsDomainApi } from "@features/document/api/documents.ts";
import { findDocById, upsertCatalogItem } from "@features/document/lib/catalog.ts";
import { buildDocumentCardPreview } from "@features/document/lib/preview.ts";
import { DocumentDetailFallback } from "@features/document/ui/detail/DocumentDetailFallback.tsx";
import { buildDocumentState } from "@features/document/ui/detail/detail.utils.ts";
import { useDocumentDetailState } from "@features/document/ui/detail/useDocumentDetailState.ts";
import { fetchLnbDocuments, layoutActions, selectFolders } from "@features/layout/index.ts";
import { pagesApi } from "@features/layout/api/pages.ts";
import type { FolderItem } from "@features/layout/ui/lnb/Lnb.types.ts";

import styles from "./DocumentDetailView.module.css";

type ChildPageState = {
  id: string;
  title: string;
};

type ChildPageDropHint = {
  targetId: string;
  placement: "before" | "after";
};

function findFolderNodeById(nodes: FolderItem[], targetId: string): FolderItem | null {
  for (const node of nodes) {
    if (node.id === targetId || node.docId === targetId) return node;
    if (node.children?.length) {
      const found = findFolderNodeById(node.children, targetId);
      if (found) return found;
    }
  }

  return null;
}

function DocumentDetailView(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const folders = useAppSelector(selectFolders);
  const [childPagePreviewById, setChildPagePreviewById] = useState<Record<string, string>>({});
  const [draggingChildPageId, setDraggingChildPageId] = useState<string | null>(null);
  const [childDropHint, setChildDropHint] = useState<ChildPageDropHint | null>(null);
  const [closeMenuSignal, setCloseMenuSignal] = useState<number>(0);

  const syncDocumentLabel = useCallback((documentId: string, title: string, createdAt?: string): void => {
    upsertCatalogItem({
      id: documentId,
      title,
      accent: "#D7D7D7",
      kind: "documents",
      createdAt: createdAt ?? findDocById(documentId)?.createdAt,
    });
    dispatch(layoutActions.renamePage({ pageId: documentId, title }));
  }, [dispatch]);

  const {
    documentState,
    error,
    loading,
    saveDocumentTitle,
    titleDraft,
    titleError,
    titleSaveState,
    updateTitleDraft,
  } = useDocumentDetailState({
    documentId: id ?? null,
    onTitleSync: syncDocumentLabel,
  });

  useEffect(() => {
    if (!id) return;
    dispatch(layoutActions.recordRecent(id));
    dispatch(layoutActions.setLastLocation({ docId: id }));
  }, [dispatch, id]);

  const childPages = useMemo<ChildPageState[]>(() => {
    if (!id) return [];

    const parentNode = findFolderNodeById(folders, id);
    if (!parentNode?.children?.length) return [];

    return parentNode.children.map((child) => ({
      id: child.docId ?? child.id,
      title: child.label,
    }));
  }, [folders, id]);

  useEffect(() => {
    const pendingChildren = childPages.filter((child) => childPagePreviewById[child.id] == null);
    if (pendingChildren.length === 0) return;

    let cancelled = false;

    async function loadChildPreviews(): Promise<void> {
      const settled = await Promise.allSettled(
        pendingChildren.map(async (child) => {
          const blocks = await documentsDomainApi.getDocumentBlocks(child.id);
          const previewItems = buildDocumentCardPreview(blocks);

          return {
            childId: child.id,
            preview: previewItems[0]?.text ?? "",
          };
        }),
      );

      if (cancelled) return;

      setChildPagePreviewById((current) => {
        const next = { ...current };

        settled.forEach((result, index) => {
          const childId = pendingChildren[index].id;
          next[childId] = result.status === "fulfilled" ? result.value.preview : "";
        });

        return next;
      });
    }

    void loadChildPreviews();
    return () => {
      cancelled = true;
    };
  }, [childPagePreviewById, childPages]);

  const moveChildPage = useCallback(async (
    childId: string,
    targetId: string,
    placement: "before" | "after",
  ): Promise<void> => {
    if (!id) return;
    if (childId === targetId) return;

    const siblings = childPages.map((child) => child.id);
    const nextOrder = siblings.filter((candidateId) => candidateId !== childId);
    const targetIndex = nextOrder.indexOf(targetId);
    if (targetIndex < 0) return;

    const insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
    nextOrder.splice(insertIndex, 0, childId);

    if (siblings.join("|") === nextOrder.join("|")) return;

    const finalIndex = nextOrder.indexOf(childId);
    const beforeDocumentId = finalIndex < nextOrder.length - 1 ? nextOrder[finalIndex + 1] : null;
    const afterDocumentId = finalIndex > 0 ? nextOrder[finalIndex - 1] : null;

    await pagesApi.moveDocument(childId, {
      targetParentId: id,
      afterDocumentId,
      beforeDocumentId,
    });

    await dispatch(fetchLnbDocuments());
  }, [childPages, dispatch, id]);

  if (!id) {
    return (
      <DocumentDetailFallback
        lead="링크가 만료되었거나 문서가 아직 준비되지 않았습니다."
        statusMessage="문서가 존재하지 않거나 아직 불러오지 못했습니다."
        onBack={() => navigate("/documents")}
      />
    );
  }

  if (loading && !documentState) {
    return (
      <section className={`${styles.content} ${styles.loadingState}`} aria-busy="true" aria-label="문서를 불러오는 중">
        <div className={styles.loadingSpinner} aria-hidden="true" />
      </section>
    );
  }

  if (error && !documentState) {
    return (
      <DocumentDetailFallback
        lead={error}
        statusMessage={error}
        onBack={() => navigate("/documents")}
      />
    );
  }

  const doc = documentState ?? buildDocumentState(id, "Untitled", 0);
  return (
    <section className={styles.content}>
      <div className={styles.editorStage}>
        <div
          className={styles.editorScrollContainer}
          onMouseDownCapture={(event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest(`.${styles.titleInput}`)) return;
            if (target.closest("[data-block-editor-menu='true']")) return;
            if (target.closest("[data-block-editor-trigger='true']")) return;
            setCloseMenuSignal((current) => current + 1);
          }}
        >
          <div className={styles.editorCenterView}>
            <div className={styles.editorCanvas}>
              <div className={styles.titleShell}>
                <input
                  className={styles.titleInput}
                  value={titleDraft}
                  placeholder="Untitled"
                  aria-label="문서 제목"
                  readOnly={titleSaveState === "saving"}
                  onChange={(event) => updateTitleDraft(event.target.value)}
                  onBlur={() => void saveDocumentTitle()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      updateTitleDraft(doc.title);
                      event.currentTarget.blur();
                    }
                  }}
                />
                {titleError ? <p className={styles.titleError}>{titleError}</p> : null}
              </div>

              <div className={styles.titleDivider} aria-hidden="true" />

              <div className={styles.editorBody}>
                <BlockEditor documentId={doc.id} closeMenuSignal={closeMenuSignal} />

                {childPages.length > 0 ? (
                  <div className={styles.childPages}>
                    {childPages.map((childPage) => (
                      <div
                        key={childPage.id}
                        className={[
                          styles.childPageShell,
                          draggingChildPageId === childPage.id ? styles.childPageShellDragging : "",
                          childDropHint?.targetId === childPage.id && childDropHint.placement === "before"
                            ? styles.childPageDropBefore
                            : "",
                          childDropHint?.targetId === childPage.id && childDropHint.placement === "after"
                            ? styles.childPageDropAfter
                            : "",
                        ].filter(Boolean).join(" ")}
                        draggable
                        onDragStart={(event) => {
                          setDraggingChildPageId(childPage.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", childPage.id);
                        }}
                        onDragEnd={() => {
                          setDraggingChildPageId(null);
                          setChildDropHint(null);
                        }}
                        onDragOver={(event) => {
                          if (!draggingChildPageId || draggingChildPageId === childPage.id) return;

                          event.preventDefault();
                          const rect = event.currentTarget.getBoundingClientRect();
                          const placement = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                          setChildDropHint({
                            targetId: childPage.id,
                            placement,
                          });
                        }}
                        onDrop={(event) => {
                          if (!draggingChildPageId || draggingChildPageId === childPage.id || !childDropHint) return;

                          event.preventDefault();
                          const nextHint = childDropHint;
                          setDraggingChildPageId(null);
                          setChildDropHint(null);
                          void moveChildPage(draggingChildPageId, nextHint.targetId, nextHint.placement);
                        }}
                      >
                        <button
                          type="button"
                          className={styles.childPageBlock}
                          onClick={() => navigate(`/doc/${childPage.id}`)}
                        >
                          <span className={styles.childPageIcon} aria-hidden="true">
                            <Icon name="document" source="url" basePath="/icons" size={18} />
                          </span>
                          <span className={styles.childPageCopy}>
                            <span className={styles.childPageTitle}>{childPage.title}</span>
                            <span className={styles.childPagePreview}>
                              {childPagePreviewById[childPage.id] || "하위 페이지"}
                            </span>
                          </span>
                          <span className={styles.childPageDrag} aria-hidden="true">⋮⋮</span>
                          <span className={styles.childPageArrow} aria-hidden="true">›</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { DocumentDetailView };
