/**
 * Document Detail Page 라우트 엔트리 컴포넌트입니다.
 */

import React from "react";

import { DocumentDetailView } from "@features/document/index.ts";

/**
 * 문서 상세 라우트 엔트리 컴포넌트입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DocumentDetailPage(): React.ReactElement {
    return <DocumentDetailView />;
}

export default DocumentDetailPage;
