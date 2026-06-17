/**
 * 테마 상태와 토글 컨텍스트를 제공합니다.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "@app/provider/ThemeContext.ts";
import type { ProvidersProps, Theme, ThemeContextValue, ThemePreference } from "@app/provider/provider.types.ts";

/**
 * 선택한 테마를 저장할 localStorage 키입니다.
 */
const THEME_STORAGE_KEY = "admin-theme";

function resolveSystemTheme(): Theme {
    if (typeof window === "undefined") {
        return "light";
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * 저장된 값과 OS 설정을 기준으로 초기 테마를 계산합니다.
 * @returns 초기 테마 값을 반환합니다.
 */
const getInitialTheme = (): ThemePreference => {
    if (typeof window === "undefined") {
        return "system";
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "system" || stored === "light" || stored === "dark") {
        return stored;
    }

    return "system";
};

/**
 * 테마 context 값을 하위 트리에 제공하는 provider 컴포넌트입니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
const ThemeProvider: React.FC<ProvidersProps> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemePreference>(() => getInitialTheme());
    const [systemTheme, setSystemTheme] = useState<Theme>(() => resolveSystemTheme());

    const resolvedTheme: Theme = theme === "system" ? systemTheme : theme;

    const setTheme = useCallback((next: ThemePreference) => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(THEME_STORAGE_KEY, next);
        }
        if (next === "system") {
            setSystemTheme(resolveSystemTheme());
        }
        setThemeState((currentTheme) => (currentTheme === next ? currentTheme : next));
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }, [resolvedTheme, setTheme]);

    useEffect(() => {
        if (theme !== "system" || typeof window === "undefined") return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (event: MediaQueryListEvent) => {
            setSystemTheme(event.matches ? "dark" : "light");
        };

        mediaQuery.addEventListener("change", onChange);
        return () => mediaQuery.removeEventListener("change", onChange);
    }, [theme]);

    useEffect(() => {
        if (typeof document === "undefined") return;

        const root = document.documentElement; // <html>

        // 한 번만 theme-loaded 붙여서 body 보이게
        if (!root.classList.contains("theme-loaded")) {
            root.classList.add("theme-loaded");
        }

        if (resolvedTheme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [resolvedTheme]);

    const value = useMemo<ThemeContextValue>(() => ({
        theme,
        resolvedTheme,
        toggleTheme,
        setTheme,
    }), [resolvedTheme, setTheme, theme, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

export {ThemeProvider};
