/**
 * 문서 상세 화면의 상단 정보와 에디터 영역을 구성합니다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button, Icon } from "@jho951/ui-components";

import { useAppDispatch, useAppSelector } from "@app/store/hooks.ts";
import { BlockEditor } from "@features/editor/index.ts";
import { documentsDomainApi } from "@features/document/api/documents.ts";
import { findDocById, upsertCatalogItem } from "@features/document/lib/catalog.ts";
import { buildDocumentCardPreview } from "@features/document/lib/preview.ts";
import { pagesApi } from "@features/layout/api/pages.ts";
import { fetchLnbDocuments, layoutActions, selectFolders } from "@features/layout/index.ts";
import type { FolderItem } from "@features/layout/ui/lnb/Lnb.types.ts";
import type { HttpError } from "@shared/api/client.types.ts";

import styles from "./DocumentDetailView.module.css";

type DocumentDetailState = {
    id: string;
    title: string;
    version: number;
    createdAt?: string;
};

type ChildPageState = {
    id: string;
    title: string;
};

type ChildPageDropHint = {
    targetId: string;
    placement: "before" | "after";
};

function normalizeDocumentTitle(title: string | null | undefined): string {
    const nextTitle = String(title ?? "").trim();
    return nextTitle || "Untitled";
}

function buildDocumentState(
    id: string,
    title: string | null | undefined,
    version: number | null | undefined,
    createdAt?: string,
): DocumentDetailState {
    return {
        id,
        title: normalizeDocumentTitle(title),
        version: version ?? 0,
        createdAt,
    };
}

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

/**
 * 문서 상세 화면의 상단 정보와 에디터 영역을 구성합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DocumentDetailView(): React.ReactElement {
    const { id } = useParams<{ id: string }>();

    const navigate = useNavigate();

    const dispatch = useAppDispatch();
    const folders = useAppSelector(selectFolders);

    const [documentState, setDocumentState] = useState<DocumentDetailState | null>(null);
    const [titleDraft, setTitleDraft] = useState<string>("");
    const [titleSaveState, setTitleSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [titleError, setTitleError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(Boolean(id));
    const [error, setError] = useState<string | null>(null);
    const [childPagePreviewById, setChildPagePreviewById] = useState<Record<string, string>>({});
    const [draggingChildPageId, setDraggingChildPageId] = useState<string | null>(null);
    const [childDropHint, setChildDropHint] = useState<ChildPageDropHint | null>(null);

    function syncDocumentLabel(documentId: string, title: string, createdAt?: string): void {
        upsertCatalogItem({
            id: documentId,
            title,
            accent: "#D7D7D7",
            kind: "documents",
            createdAt: createdAt ?? findDocById(documentId)?.createdAt,
        });
        dispatch(layoutActions.renamePage({ pageId: documentId, title }));
    }

    useEffect(() => {
        if (!id) {
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
                const response = await pagesApi.getPage(id);
                if (cancelled) return;

                const nextDocument = buildDocumentState(response.id, response.title, response.version, response.createdAt);
                setDocumentState(nextDocument);
                setTitleDraft(nextDocument.title);
                setTitleSaveState("idle");
                setTitleError(null);
                syncDocumentLabel(nextDocument.id, nextDocument.title, nextDocument.createdAt);
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
    }, [id]);

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

    useEffect(() => {
        if (titleSaveState !== "saved") return;

        const timer = window.setTimeout(() => {
            setTitleSaveState((current) => (current === "saved" ? "idle" : current));
        }, 1800);

        return () => window.clearTimeout(timer);
    }, [titleSaveState]);

    async function moveChildPage(
        childId: string,
        targetId: string,
        placement: "before" | "after",
    ): Promise<void> {
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
    }

    async function saveDocumentTitle(): Promise<void> {
        if (!id || !documentState) return;
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
            const latestPage = await pagesApi.getPage(id);
            const latestDocument = buildDocumentState(id, latestPage.title, latestPage.version, latestPage.createdAt);

            if (latestDocument.title === nextTitle) return latestDocument;

            try {
                const updatedPage = await pagesApi.updatePage(id, {
                    title: nextTitle,
                    version: latestDocument.version,
                });
                return buildDocumentState(id, updatedPage.title, updatedPage.version, updatedPage.createdAt ?? latestDocument.createdAt);
            } catch (updateError) {
                const httpError = updateError as HttpError;
                if (httpError.status !== 409) throw updateError;

                const retriedPage = await pagesApi.getPage(id);
                const retriedDocument = buildDocumentState(id, retriedPage.title, retriedPage.version, retriedPage.createdAt);

                if (retriedDocument.title === nextTitle) return retriedDocument;

                const updatedPage = await pagesApi.updatePage(id, {
                    title: nextTitle,
                    version: retriedDocument.version,
                });
                return buildDocumentState(id, updatedPage.title, updatedPage.version, updatedPage.createdAt ?? retriedDocument.createdAt);
            }
        };

        try {
            const updatedDocument = await updateWithLatestVersion();
            setDocumentState(updatedDocument);
            setTitleDraft(updatedDocument.title);
            setTitleSaveState("saved");
            syncDocumentLabel(updatedDocument.id, updatedDocument.title, updatedDocument.createdAt);
        } catch (saveError) {
            setTitleSaveState("error");
            setTitleError(saveError instanceof Error ? saveError.message : "제목을 저장하지 못했습니다.");
        }
    }

    if (!id) {
        return (
            <section className={styles.content}>
                <div className={styles.headerRow}>
                    <div className={styles.headerCopy}>
                        <div className={styles.headerTitleGroup}>
                            <div className={styles.pageEyebrow}>문서 없음</div>
                            <div className={styles.tab}>
                                <h1 className={styles.tabIcon}>문서를 찾을 수 없습니다.</h1>
                            </div>
                        </div>
                        <p className={styles.headerLead}>링크가 만료되었거나 문서가 아직 준비되지 않았습니다.</p>
                    </div>
                </div>
                <div className={`${styles.surfacePanel} ${styles.emptyState}`}>
                    <div className={styles.statusRow}>문서가 존재하지 않거나 아직 불러오지 못했습니다.</div>
                    <Button type="button" variant="ghost" onClick={() => navigate("/documents")}>
                        문서 목록으로 이동
                    </Button>
                </div>
            </section>
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
            <section className={styles.content}>
                <div className={styles.headerRow}>
                    <div className={styles.headerCopy}>
                        <div className={styles.headerTitleGroup}>
                            <div className={styles.pageEyebrow}>문서 없음</div>
                            <div className={styles.tab}>
                                <h1 className={styles.tabIcon}>문서를 찾을 수 없습니다.</h1>
                            </div>
                        </div>
                        <p className={styles.headerLead}>{error}</p>
                    </div>
                </div>
                <div className={`${styles.surfacePanel} ${styles.emptyState}`}>
                    <div className={styles.statusRow}>{error}</div>
                    <Button type="button" variant="ghost" onClick={() => navigate("/documents")}>
                        문서 목록으로 이동
                    </Button>
                </div>
            </section>
        );
    }

    const doc = documentState ?? buildDocumentState(id, "Untitled", 0);
    return (
        <section className={styles.content}>
            <div className={styles.editorStage}>
                <div className={styles.editorScrollContainer}>
                    <div className={styles.editorCenterView}>
                        <div className={styles.editorCanvas}>
                            <div className={styles.titleShell}>
                                <input
                                    className={styles.titleInput}
                                    value={titleDraft}
                                    placeholder="Untitled"
                                    aria-label="문서 제목"
                                    readOnly={titleSaveState === "saving"}
                                    onChange={(event) => {
                                        setTitleDraft(event.target.value);
                                        if (titleSaveState !== "idle") setTitleSaveState("idle");
                                        if (titleError) setTitleError(null);
                                    }}
                                    onBlur={() => void saveDocumentTitle()}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            event.currentTarget.blur();
                                        }
                                        if (event.key === "Escape") {
                                            event.preventDefault();
                                            setTitleDraft(doc.title);
                                            setTitleSaveState("idle");
                                            setTitleError(null);
                                            event.currentTarget.blur();
                                        }
                                    }}
                                />
                                {titleError ? <p className={styles.titleError}>{titleError}</p> : null}
                            </div>

                            <div className={styles.titleDivider} aria-hidden="true" />

                            <div className={styles.editorBody}>
                                <BlockEditor documentId={doc.id} />

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
