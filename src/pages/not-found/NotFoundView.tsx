/**
 * 404 화면 전체 구성을 렌더링합니다.
 */

import React from "react";
import { Link } from "react-router-dom";

import styles from "./NotFoundView.module.css";

/**
 * 404 안내 화면을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function NotFoundView(): React.ReactElement {
    return (
        <main className={styles.wrapper}>
            <p>404</p>
            <h1>페이지를 찾을 수 없습니다.</h1>
            <p>주소가 바뀌었거나 더 이상 제공되지 않는 화면입니다.</p>
            <Link to="/" className={styles.homeLink}>
                홈으로 이동
            </Link>
        </main>
    );
}

export { NotFoundView };
