import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import {AppRouter} from "@app/router/AppRouter.tsx";
import { AuthGate } from "@features/auth/index.ts";
import {
  AuthCallbackPage,
  DeletePage,
  DocumentDetailPage,
  DocumentsPage,
  HomePage,
  NotFoundPage,
  SharedPage,
  SignInRedirectPage,
} from "@pages/index.ts";

/**
 * 브라우저 전체 경로 구성
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthGate><AppRouter /></AuthGate>}>
          <Route path="/" element={<HomePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/shared" element={<SharedPage />} />
          <Route path="/doc/:id" element={<DocumentDetailPage />} />
          <Route path="/delete" element={<DeletePage />} />
          <Route path="/delete/:id" element={<DeletePage />} />
        </Route>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/signin" element={<SignInRedirectPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
