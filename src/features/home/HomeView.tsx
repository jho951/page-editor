/**
 * Home View 화면을 구성하는 뷰 컴포넌트입니다.
 */

import React from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Icon } from "@jho951/ui-components";

import { DocumentCard, findDocById, getAllDocs } from "@features/document/index.ts";
import { selectPinnedDocIds, selectRecentDocIds } from "@features/layout/index.ts";

import styles from "./HomeView.module.css";

/**
 * 홈 화면의 최근 문서와 즐겨찾기 목록을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function HomeView(): React.ReactElement {

    const navigate = useNavigate();

    const recentIds = useSelector(selectRecentDocIds);

    const pinnedIds = useSelector(selectPinnedDocIds);

    const catalogDocs = getAllDocs();

    const recentDocs = recentIds
        .map((id) => findDocById(id) ?? catalogDocs.find((doc) => doc.id === id))
        .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
        .slice(0, 4);

    const pinnedDocs = pinnedIds
        .map((id) => findDocById(id) ?? catalogDocs.find((doc) => doc.id === id))
        .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
        .slice(0, 4);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>안녕하세요.</h1>
            </header>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>최근 방문</div>
                </div>
                <div className={styles.cards}>
                    {recentDocs.map((doc) => (
                        <div key={doc.id}>
                            <DocumentCard item={doc} onClick={() => navigate(`/doc/${doc.id}`)} />
                        </div>
                    ))}
                    {recentDocs.length === 0 && <div className={styles.empty}>최근 방문한 문서가 없습니다.</div>}
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                        <Icon name="star" size={14} />
                        <span>즐겨찾기</span>
                    </div>
                </div>
                <div className={styles.cards}>
                    {pinnedDocs.map((doc) => (
                        <div key={doc.id}>
                            <DocumentCard item={doc} onClick={() => navigate(`/doc/${doc.id}`)} />
                        </div>
                    ))}
                    {pinnedDocs.length === 0 && <div className={styles.empty}>즐겨찾기된 문서가 없습니다.</div>}
                </div>
            </section>

        </div>
    );
}

export { HomeView };
