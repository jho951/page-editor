import { createContext } from "react";

import type { ThemeContextValue } from "@app/provider/provider.types.ts";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export { ThemeContext };
