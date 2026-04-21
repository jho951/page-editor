/**
 * Home Page 라우트 엔트리 컴포넌트입니다.
 */

import React from "react";

import { HomeView } from "@features/home/index.ts";

/**
 * 홈 라우트 엔트리 컴포넌트입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function HomePage(): React.ReactElement {
    return <HomeView />;
}

export default HomePage;
