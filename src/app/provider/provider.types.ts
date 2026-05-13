/**
 * provider 관련 타입을 정의합니다.
 */

import React from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export interface ThemeContextValue {
    theme: ThemePreference;
    resolvedTheme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: ThemePreference) => void;
}

export type ProvidersProps = {
    children: React.ReactNode;
};
