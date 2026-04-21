/**
 * Trash View 화면을 구성하는 뷰 컴포넌트입니다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";

import { Button, Icon } from "@jho951/ui-components";

import { useAppDispatch } from "@app/store/hooks.ts";
import { fetchTrashDocumentsRemote } from "@features/layout/state/layout.slice.ts";
import { selectTrashItems } from "@features/layout/state/layout.selector.ts";

import styles from "./TrashView.module.css";

/**
 * 삭제 시각을 화면용 문자열로 변환합니다.
 *
 * @param ts 포맷할 삭제 시각 타임스탬프입니다.
 * @returns 사용자 화면에 표시할 날짜 문자열을 반환합니다.
 */
function formatDeletedAt(ts: number): string {
    return new Date(ts).toLocaleString();
}

/**
 * 휴지통 목록과 삭제 항목 상세 화면을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function TrashView(): React.ReactElement {

    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();

    const trashItems = useSelector(selectTrashItems);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let alive = true;

        async function loadTrash(): Promise<void> {
            setIsLoading(true);

            try {
                await dispatch(fetchTrashDocumentsRemote()).unwrap();
            } catch {
                // 휴지통 목록은 기존 상태를 유지하고, 빈 화면으로만 떨어지지 않게 합니다.
            } finally {
                if (alive) setIsLoading(false);
            }
        }

        void loadTrash();

        return () => {
            alive = false;
        };
    }, [dispatch]);

    const selected = useMemo(() => trashItems.find((item) => item.id === id) ?? null, [trashItems, id]);

    if (!id) {
        return (
            <section className={styles.page}>
                <section className={styles.listOnlyPane} aria-label="삭제된 페이지 목록">
                    <header className={styles.listHead}>
                        <span className={styles.listTitle}>휴지통</span>
                    </header>
                    <p className={styles.listHint}>삭제된 페이지를 선택하면 상세 내용을 볼 수 있습니다.</p>

                    <div className={`${styles.listOnly} ${trashItems.length === 0 ? styles.listOnlyEmpty : ""}`}>
                        {isLoading ? (
                            <div className={styles.empty}>휴지통을 불러오는 중입니다.</div>
                        ) : trashItems.length === 0 ? (
                            <div className={styles.empty}>휴지통이 비어 있습니다.</div>
                        ) : (
                            trashItems.map((item) => (
                                <Button
                                    key={item.id}
                                    type="button"
                                    variant="ghost"
                                    size="s"
                                    className={styles.item}
                                    onClick={() => navigate(`/delete/${item.id}`)}
                                >
                                    <span className={styles.itemMain}>
                                        <Icon name="document" source="url" basePath="/icons" size={14} />
                                        <span className={styles.itemTitle}>{item.label}</span>
                                    </span>
                                    <span className={styles.itemTime}>{formatDeletedAt(item.deletedAt)}</span>
                                </Button>
                            ))
                        )}
                    </div>
                </section>
            </section>
        );
    }

    return (
        <section className={styles.page}>
            <article className={styles.detailOnlyPane} aria-label="삭제 항목 상세">
                {selected ? (
                    <>
                        <div className={styles.detailHeader}>
                            <Icon name="document" source="url" basePath="/icons" size={16} />
                            <h1 className={styles.detailTitle}>{selected.label}</h1>
                        </div>
                        <p className={styles.detailMeta}>삭제됨 {formatDeletedAt(selected.deletedAt)}</p>
                        <div className={styles.docBody}>
                            <p className={styles.detailDesc}>
                                블록 에디터와 캔버스 기능이 제거되어, 휴지통 상세 화면에서는 메타 정보만 표시합니다.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyDetail}>
                        <Icon name="trash" source="url" basePath="/icons" size={18} />
                        <span>왼쪽 목록에서 항목을 선택하세요.</span>
                    </div>
                )}
            </article>
        </section>
    );
}

export { TrashView };
