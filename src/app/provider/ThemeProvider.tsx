/* eslint-disable react-refresh/only-export-components */
/**
 * 테마 상태와 토글 컨텍스트를 제공합니다.
 */
import React, {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";
import type {ProvidersProps, Theme, ThemeContextValue} from "@app/provider/provider.types.ts";

/**
 * 현재 테마 값을 공유하는 React context입니다.
 */
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * 선택한 테마를 저장할 localStorage 키입니다.
 */
const THEME_STORAGE_KEY = "admin-theme";

/**
 * 저장된 값과 OS 설정을 기준으로 초기 테마를 계산합니다.
 * @returns 초기 테마 값을 반환합니다.
 */
const getInitialTheme = (): Theme => {
    if (typeof window === "undefined") {
        return "light";
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
        return stored;
    }

    // 2) 시스템 설정

    const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)",
    ).matches;

    return prefersDark ? "dark" : "light";
};

/**
 * 테마 context 값을 하위 트리에 제공하는 provider 컴포넌트입니다.
 *
 * @param props 컴포넌트에 전달된 props 객체입니다.
 * @returns 렌더링할 React 엘리먼트를 반환합니다.
 */
const ThemeProvider: React.FC<ProvidersProps> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

    const setTheme = (next: Theme) => {
        setThemeState(next);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(THEME_STORAGE_KEY, next);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === "light" ? "dark" : "light");
    };

    useEffect(() => {
        if (typeof document === "undefined") return;

        const root = document.documentElement; // <html>

        // 한 번만 theme-loaded 붙여서 body 보이게
        if (!root.classList.contains("theme-loaded")) {
            root.classList.add("theme-loaded");
        }

        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [theme]);

    const value: ThemeContextValue = {
        theme,
        toggleTheme,
        setTheme,
    };

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

/**
 * 현재 테마와 테마 변경 함수를 제공하는 훅입니다.
 * @returns 화면 제어에 필요한 상태와 핸들러 객체를 반환합니다.
 */
export const useTheme = (): ThemeContextValue => {

    const ctx = useContext(ThemeContext);
    if (!ctx) { throw new Error("useTheme must be used within ThemeProvider");}
    return ctx;
};

export {ThemeProvider};
