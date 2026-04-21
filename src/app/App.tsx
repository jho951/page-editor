import ReactDOM from "react-dom/client";

import Router from '@app/router/router.tsx';
import {AppProviders} from "@app/provider/AppProviders.tsx";
import { installGlobalFetchCredentialsInclude } from "@shared/api/fetch-defaults.ts";

import '@assets/styles/theme.css';
import '@assets/styles/reset.css';
import '@assets/styles/class.css';

installGlobalFetchCredentialsInclude();

/** 애플리케이션을 렌더링하고 전역 provider와 라우터를 연결하는 진입 파일입니다. */
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <AppProviders>
            <Router />
       </AppProviders>
);
