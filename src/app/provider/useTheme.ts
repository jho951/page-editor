import { useContext } from "react";

import { ThemeContext } from "@app/provider/ThemeContext.ts";
import type { ThemeContextValue } from "@app/provider/provider.types.ts";

function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}

export { useTheme };
