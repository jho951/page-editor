/**
 * Documents Page 라우트 엔트리 컴포넌트입니다.
 */

import React from "react";

import { DocumentCatalogView } from "@features/document/index.ts";

/**
 * 문서 목록 라우트 엔트리 컴포넌트입니다.
 *
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DocumentsPage(): React.ReactElement {
    return <DocumentCatalogView mode="documents" />;
}

export default DocumentsPage;
