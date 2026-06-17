import { createContext } from "react";

import type { LanguageContextValue } from "@app/provider/provider.types.ts";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export { LanguageContext };
