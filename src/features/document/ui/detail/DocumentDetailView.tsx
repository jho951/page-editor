/**
 * 문서 상세 화면의 상단 정보와 에디터 영역을 구성합니다.
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@jho951/ui-components";

import { useAppDispatch } from "@app/store/hooks.ts";
import { BlockEditor } from "@features/editor/index.ts";
import { upsertCatalogItem } from "@features/document/lib/catalog.ts";
import { pagesApi } from "@features/layout/api/pages.ts";
import { layoutActions } from "@features/layout/index.ts";
import type { HttpError } from "@shared/api/client.types.ts";

import styles from "./DocumentDetailView.module.css";

type DocumentDetailState = {
    id: string;
    title: string;
    version: number;
};

function normalizeDocumentTitle(title: string | null | undefined): string {
    const nextTitle = String(title ?? "").trim();
    return nextTitle || "Untitled";
}

function buildDocumentState(id: string, title: string | null | undefined, version: number | null | undefined): DocumentDetailState {
    return {
        id,
        title: normalizeDocumentTitle(title),
        version: version ?? 0,
    };
}

/**
 * 문서 상세 화면의 상단 정보와 에디터 영역을 구성합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DocumentDetailView(): React.ReactElement {
    const { id } = useParams<{ id: string }>();

    const navigate = useNavigate();

    const dispatch = useAppDispatch();

    const [documentState, setDocumentState] = useState<DocumentDetailState | null>(null);
    const [titleDraft, setTitleDraft] = useState<string>("");
    const [titleSaveState, setTitleSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [titleError, setTitleError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(Boolean(id));
    const [error, setError] = useState<string | null>(null);

    function syncDocumentLabel(documentId: string, title: string): void {
        upsertCatalogItem({
            id: documentId,
            title,
            accent: "#D7D7D7",
            kind: "documents",
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

                const nextDocument = buildDocumentState(response.id, response.title, response.version);
                setDocumentState(nextDocument);
                setTitleDraft(nextDocument.title);
                setTitleSaveState("idle");
                setTitleError(null);
                syncDocumentLabel(nextDocument.id, nextDocument.title);
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

    useEffect(() => {
        if (titleSaveState !== "saved") return;

        const timer = window.setTimeout(() => {
            setTitleSaveState((current) => (current === "saved" ? "idle" : current));
        }, 1800);

        return () => window.clearTimeout(timer);
    }, [titleSaveState]);

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
            const latestDocument = buildDocumentState(id, latestPage.title, latestPage.version);

            if (latestDocument.title === nextTitle) return latestDocument;

            try {
                const updatedPage = await pagesApi.updatePage(id, {
                    title: nextTitle,
                    version: latestDocument.version,
                });
                return buildDocumentState(id, updatedPage.title, updatedPage.version);
            } catch (updateError) {
                const httpError = updateError as HttpError;
                if (httpError.status !== 409) throw updateError;

                const retriedPage = await pagesApi.getPage(id);
                const retriedDocument = buildDocumentState(id, retriedPage.title, retriedPage.version);

                if (retriedDocument.title === nextTitle) return retriedDocument;

                const updatedPage = await pagesApi.updatePage(id, {
                    title: nextTitle,
                    version: retriedDocument.version,
                });
                return buildDocumentState(id, updatedPage.title, updatedPage.version);
            }
        };

        try {
            const updatedDocument = await updateWithLatestVersion();
            setDocumentState(updatedDocument);
            setTitleDraft(updatedDocument.title);
            setTitleSaveState("saved");
            syncDocumentLabel(updatedDocument.id, updatedDocument.title);
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
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export { DocumentDetailView };
