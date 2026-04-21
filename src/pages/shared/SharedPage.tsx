/**
 * Shared Page 라우트 엔트리 컴포넌트입니다.
 */

import React from "react";

import { SharedView } from "./SharedView.tsx";

/**
 * 공유 문서 라우트 엔트리 컴포넌트입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function SharedPage(): React.ReactElement {
    return <SharedView />;
}

export default SharedPage;
