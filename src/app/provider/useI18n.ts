import { useContext } from "react";

import { LanguageContext } from "@app/provider/LanguageContext.ts";
import type { LanguageContextValue } from "@app/provider/provider.types.ts";

function useI18n(): LanguageContextValue {
    const context = useContext(LanguageContext);

    if (!context) {
        throw new Error("useI18n must be used within LanguageProvider");
    }

    return context;
}

export { useI18n };
