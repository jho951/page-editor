/**
 * 404 화면 전체 구성을 렌더링합니다.
 */

import React from "react";
import { Link } from "react-router-dom";

import { NotFoundTiles } from "./NotFoundTiles.tsx";
import styles from "./NotFoundView.module.css";

/**
 * 404 안내 화면을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function NotFoundView(): React.ReactElement {
    return (
        <main className={styles.notFoundContainer} data-page-kind="not-found">
            <h1 className={styles.notFoundTitle}>페이지를 찾을 수 없습니다.</h1>
            <section className={styles.notFoundTileWrapper}>
                <NotFoundTiles />
            </section>
            <Link to="/" className={styles.homeLink}>
                홈으로 돌아가기
            </Link>
        </main>
    );
}

export { NotFoundView };
