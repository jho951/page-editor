/** 공통 레이아웃 안에서 중첩 라우트를 렌더링하는 라우터 셸 컴포넌트입니다. */

import { useEffect, useEffectEvent, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { useI18n } from "@app/provider/useI18n.ts";
import type { AppDispatch } from "@app/store/store.ts";
import { useTheme } from "@app/provider/useTheme.ts";

import {
    selectLastLocation,
    selectPinnedDocIds,
    selectRecentDocIds,
    selectSidebarActiveKey,
} from "@features/layout/index.ts";
import {findDocById} from "@features/document/index.ts";
import { selectAuthUser } from "@features/auth/index.ts";
import type {LnbActiveKey} from "@features/layout/index.ts";
import { Gnb, Lnb, layoutActions } from "@features/layout/index.ts";
import { shortcutsActions, selectShortcutPending } from "@features/shortcuts/index.ts";
import { Icon } from "@jho951/ui-components";

import styles from '@app/router/AppRouter.module.css'

/**
 * 현재 경로를 LNB 활성 키로 변환합니다.
 *
 * @param pathname 현재 브라우저 경로 문자열입니다.
 * @returns 경로에 해당하는 LNB 활성 키를 반환합니다.
 */
function pathToActiveKey(pathname: string): LnbActiveKey {
    if (pathname === "/") return "home";
    if (pathname.startsWith("/documents")) return "allDocs";
    if (pathname.startsWith("/shared")) return "shared";
    if (pathname.startsWith("/delete")) return "trash";
    if (pathname.startsWith("/doc/")) {

        const parts = pathname.split("/");

        const id = parts[2];
        return `folder:${id}` as LnbActiveKey;
    }

    if (pathname.startsWith("/folder/")) return `folder:${pathname.split("/folder/")[1]}` as LnbActiveKey;
    return "home";
}

/**
 * LNB 활성 키를 실제 경로로 변환합니다.
 *
 * @param key 변환 또는 조회에 사용할 키 값입니다.
 * @returns 라우터 이동에 사용할 경로 문자열을 반환합니다.
 */
function activeKeyToPath(key: LnbActiveKey): string {
    if (key === "home") return "/";
    if (key === "allDocs") return "/documents";
    if (key === "newDocument") return "/new";
    if (key === "shared") return "/shared";
    if (key === "trash") return "/delete";
    if (key === "settings") return "/settings";
    if (String(key).startsWith("folder:")) return `/doc/${String(key).slice("folder:".length)}`;
    return "/";
}

/**
 * 공통 레이아웃과 페이지 라우팅 상태를 연결하는 라우터 셸입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
function AppRouter() {

    const dispatch = useDispatch<AppDispatch>();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const location = useLocation();

    const navigate = useNavigate();
    const { t } = useI18n();
    const { toggleTheme } = useTheme();

    useEffect(() => {
        dispatch(shortcutsActions.setScope(location.pathname.startsWith("/doc/") ? "text" : "global"));
    }, [dispatch, location.pathname]);

    const activeKey = useSelector(selectSidebarActiveKey);

    const recentIds = useSelector(selectRecentDocIds);

    const pinnedIds = useSelector(selectPinnedDocIds);

    const lastLocation = useSelector(selectLastLocation);

    const user = useSelector(selectAuthUser);

    const recentDocs = recentIds
        .map((id) => {

            const doc = findDocById(id);
            return doc ? { id: doc.id, title: doc.title } : null;
        })
        .filter(Boolean) as { id: string; title: string }[];

    const pinnedDocs = pinnedIds
        .map((id) => {

            const doc = findDocById(id);
            return doc ? { id: doc.id, title: doc.title } : null;
        })
        .filter(Boolean) as { id: string; title: string }[];

    const pendingShortcut = useSelector(selectShortcutPending);

    const closeMobileMenu = useEffectEvent(() => {
        setMobileMenuOpen(false);
    });

    useEffect(() => {

        const nextKey = pathToActiveKey(location.pathname);
        if (nextKey !== activeKey) {
            dispatch(layoutActions.setActiveKey(nextKey));
        }
    }, [location.pathname, activeKey, dispatch]);

    useEffect(() => {
        closeMobileMenu();
    }, [location.pathname]);

    const handlePendingShortcut = useEffectEvent(() => {
        if (!pendingShortcut) return;

        switch (pendingShortcut.command) {
            case "open-search":
                navigate("/documents");
                dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
                return;
            case "show-shortcuts":
                dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
                return;
            case "toggle-theme":
                toggleTheme();
                dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
                return;
            case "close-overlay":
                closeMobileMenu();
                dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
                return;
            case "new-page":
                if (!location.pathname.startsWith("/doc/")) {
                    dispatch(shortcutsActions.consumeShortcut(pendingShortcut.id));
                }
                return;
            default:
                return;
        }
    });

    useEffect(() => {
        if (!pendingShortcut) return;
        handlePendingShortcut();
    }, [dispatch, location.pathname, navigate, pendingShortcut, toggleTheme]);

    return (
        <div className={styles.wrap}>
            <div className={styles.desktopSidebar}>
                <Lnb
                    activeKey={activeKey}
                    onNavigate={(key) => {
                        dispatch(layoutActions.setActiveKey(key));
                        navigate(activeKeyToPath(key));
                    }}
                    recentDocs={recentDocs}
                    pinnedDocs={pinnedDocs}
                    lastLocation={lastLocation}
                    onOpenDoc={(docId) => navigate(`/doc/${docId}`)}
                    onResumeLast={(loc) => navigate(`/doc/${loc.docId}`)}
                />
            </div>
            <div className={styles.main}>
                <Gnb
                    profile={user?.name || user?.email || "U"}
                    onOpenMobileMenu={() => setMobileMenuOpen(true)}
                />

                <main className={styles.content}>
                    <Outlet />
                </main>

            </div>
            {mobileMenuOpen && (
                <div
                    className={styles.mobileOverlay}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("app.mobileMenu.aria")}
                >
                    <div className={styles.mobileOverlayPanel}>
                        <div className={styles.mobileOverlayHeader}>
                            <span className={styles.mobileOverlayLogo} aria-hidden="true">
                                <Icon name="logo" source="url" basePath="/icons" size={40} />
                            </span>
                            <button
                                type="button"
                                className={styles.mobileOverlayClose}
                                onClick={() => setMobileMenuOpen(false)}
                                aria-label={t("app.mobileMenu.close")}
                            >
                                <span className={styles.mobileOverlayCloseBar} />
                                <span className={styles.mobileOverlayCloseBar} />
                            </button>
                        </div>
                        <Lnb
                            activeKey={activeKey}
                            showTopRow={false}
                            mobileOverlay
                            onNavigate={(key) => {
                                dispatch(layoutActions.setActiveKey(key));
                                navigate(activeKeyToPath(key));
                                setMobileMenuOpen(false);
                            }}
                            recentDocs={recentDocs}
                            pinnedDocs={pinnedDocs}
                            lastLocation={lastLocation}
                            onOpenDoc={(docId) => navigate(`/doc/${docId}`)}
                            onResumeLast={(loc) => navigate(`/doc/${loc.docId}`)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export { AppRouter };
