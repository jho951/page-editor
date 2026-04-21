import React from "react";

import { TrashView } from "@features/trash/index.ts";

/**
 * 휴지통 라우트 엔트리 컴포넌트입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function DeletePage(): React.ReactElement {
    return <TrashView />;
}

export default DeletePage;
