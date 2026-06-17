/**
 * 404 화면 전체 구성을 렌더링합니다.
 */

import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@app/provider/useI18n.ts";

import { NotFoundTiles } from "./NotFoundTiles.tsx";
import styles from "./NotFoundView.module.css";

/**
 * 404 안내 화면을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function NotFoundView(): React.ReactElement {
    const { t } = useI18n();

    return (
        <main className={styles.notFoundContainer} data-page-kind="not-found">
            <h1 className={styles.notFoundTitle}>{t("notFound.title")}</h1>
            <section className={styles.notFoundTileWrapper}>
                <NotFoundTiles />
            </section>
            <Link to="/" className={styles.homeLink}>
                {t("notFound.home")}
            </Link>
        </main>
    );
}

export { NotFoundView };
