import {
    dictionaries,
    formatTranslation,
    localeByLanguage,
    type AppLanguage,
    type TranslationKey,
    type TranslationParams,
} from "@shared/i18n/messages.ts";

const LANGUAGE_STORAGE_KEY = "editor.language";

function resolveLanguage(input: string | null | undefined): AppLanguage | null {
    if (input === "ko" || input === "en") return input;

    if (input?.toLowerCase().startsWith("ko")) return "ko";
    if (input?.toLowerCase().startsWith("en")) return "en";
    return null;
}

function getCurrentLanguage(): AppLanguage {
    if (typeof window !== "undefined") {
        const stored = resolveLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
        if (stored) return stored;

        const browserLanguage = resolveLanguage(window.navigator.language);
        if (browserLanguage) return browserLanguage;
    }

    if (typeof document !== "undefined") {
        const documentLanguage = resolveLanguage(document.documentElement.lang);
        if (documentLanguage) return documentLanguage;
    }

    return "ko";
}

function translate(key: TranslationKey, params?: TranslationParams): string {
    const language = getCurrentLanguage();
    const template = dictionaries[language][key] ?? dictionaries.ko[key] ?? key;
    return formatTranslation(template, params);
}

function formatRuntimeNumber(value: number): string {
    return new Intl.NumberFormat(localeByLanguage[getCurrentLanguage()]).format(value);
}

function formatRuntimeDateTime(
    value: number | string | Date,
    options?: Intl.DateTimeFormatOptions,
): string {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(localeByLanguage[getCurrentLanguage()], options).format(date);
}

export {
    formatRuntimeDateTime,
    formatRuntimeNumber,
    getCurrentLanguage,
    translate,
};
