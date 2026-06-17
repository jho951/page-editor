/**
 * provider 관련 타입을 정의합니다.
 */

import React from "react";
import type { AppLanguage, TranslationKey, TranslationParams } from "@shared/i18n/messages.ts";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export interface ThemeContextValue {
    theme: ThemePreference;
    resolvedTheme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: ThemePreference) => void;
}

export interface LanguageContextValue {
    language: AppLanguage;
    locale: string;
    t: (key: TranslationKey, params?: TranslationParams) => string;
    setLanguage: (language: AppLanguage) => void;
    formatNumber: (value: number) => string;
    formatDateTime: (value: number | string | Date, options?: Intl.DateTimeFormatOptions) => string;
}

export type ProvidersProps = {
    children: React.ReactNode;
};
