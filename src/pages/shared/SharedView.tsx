/**
 * Shared View 화면을 구성하는 뷰 컴포넌트입니다.
 */

import React from "react";

import styles from "./SharedView.module.css";

/**
 * 공유 문서 화면을 렌더링합니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function SharedView(): React.ReactElement {
    return (
        <section className={styles.page}>
            <div className={styles.badge}>Shared Space</div>
            <h1 className={styles.title}>공유된 문서가 여기에 표시됩니다.</h1>
            <p className={styles.desc}>공유 문서, 멤버, 권한 정보 UI를 이 영역에서 확장할 수 있습니다.</p>
        </section>
    );
}

export { SharedView };
