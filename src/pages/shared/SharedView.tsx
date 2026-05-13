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
            <article className={styles.hero}>
                <div className={styles.badge}>Shared Space</div>
                <h1 className={styles.title}>팀과 함께 보는 문서를 위한 공간</h1>
                <p className={styles.desc}>
                    공유 문서, 참여자, 권한 정보를 같은 흐름으로 확장할 수 있도록
                    전체 앱 스타일에 맞춘 밝은 협업 화면으로 정리했습니다.
                </p>
            </article>

            <div className={styles.grid}>
                <article className={styles.panel}>
                    <span className={styles.panelLabel}>권한</span>
                    <strong className={styles.panelValue}>Viewer / Editor</strong>
                    <p className={styles.panelText}>문서별 권한과 링크 공유 상태를 이 영역에서 안내할 수 있습니다.</p>
                </article>
                <article className={styles.panel}>
                    <span className={styles.panelLabel}>최근 활동</span>
                    <strong className={styles.panelValue}>Live Updates</strong>
                    <p className={styles.panelText}>누가 언제 수정했는지, 마지막 반영 시각이 자연스럽게 붙는 구성이 맞습니다.</p>
                </article>
                <article className={styles.panel}>
                    <span className={styles.panelLabel}>참여자</span>
                    <strong className={styles.panelValue}>People & Access</strong>
                    <p className={styles.panelText}>멤버 아바타와 권한 배지를 배치해 Apple식 협업 패널로 확장할 수 있습니다.</p>
                </article>
            </div>
        </section>
    );
}

export { SharedView };
