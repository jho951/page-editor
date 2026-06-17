import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LanguageContext } from "@app/provider/LanguageContext.ts";
import type { LanguageContextValue, ProvidersProps } from "@app/provider/provider.types.ts";
import {
    dictionaries,
    formatTranslation,
    localeByLanguage,
    type AppLanguage,
    type TranslationKey,
    type TranslationParams,
} from "@shared/i18n/messages.ts";

const LANGUAGE_STORAGE_KEY = "editor.language";

function getDateTimeFormatterCacheKey(options?: Intl.DateTimeFormatOptions): string {
    if (!options) return "default";

    return Object.entries(options)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}:${String(value)}`)
        .join("|");
}

function getInitialLanguage(): AppLanguage {
    if (typeof window === "undefined") return "ko";

    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "ko" || stored === "en") return stored;

    return window.navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function LanguageProvider({ children }: ProvidersProps): React.ReactElement {
    const [language, setLanguageState] = useState<AppLanguage>(() => getInitialLanguage());

    const setLanguage = useCallback((nextLanguage: AppLanguage) => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        }
        setLanguageState((currentLanguage) => (
            currentLanguage === nextLanguage ? currentLanguage : nextLanguage
        ));
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.lang = language;
    }, [language]);

    const locale = localeByLanguage[language];
    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
    const dateTimeFormatterCacheRef = useRef<{
        locale: string;
        cache: Map<string, Intl.DateTimeFormat>;
    }>({
        locale,
        cache: new Map<string, Intl.DateTimeFormat>(),
    });

    const t = useCallback((key: TranslationKey, params?: TranslationParams): string => {
        const template = dictionaries[language][key] ?? dictionaries.ko[key] ?? key;
        return formatTranslation(template, params);
    }, [language]);

    const formatNumber = useCallback((value: number): string => {
        return numberFormatter.format(value);
    }, [numberFormatter]);

    const formatDateTime = useCallback((value: number | string | Date, options?: Intl.DateTimeFormatOptions): string => {
        if (dateTimeFormatterCacheRef.current.locale !== locale) {
            dateTimeFormatterCacheRef.current = {
                locale,
                cache: new Map<string, Intl.DateTimeFormat>(),
            };
        }

        const date = value instanceof Date ? value : new Date(value);
        const cacheKey = getDateTimeFormatterCacheKey(options);
        const cachedFormatter = dateTimeFormatterCacheRef.current.cache.get(cacheKey);
        if (cachedFormatter) {
            return cachedFormatter.format(date);
        }

        const nextFormatter = new Intl.DateTimeFormat(locale, options);
        dateTimeFormatterCacheRef.current.cache.set(cacheKey, nextFormatter);
        return nextFormatter.format(date);
    }, [locale]);

    const contextValue = useMemo<LanguageContextValue>(() => ({
        language,
        locale,
        t,
        setLanguage,
        formatNumber,
        formatDateTime,
    }), [formatDateTime, formatNumber, language, locale, setLanguage, t]);

    return (
        <LanguageContext.Provider value={contextValue}>
            {children}
        </LanguageContext.Provider>
    );
}

export { LanguageProvider };
