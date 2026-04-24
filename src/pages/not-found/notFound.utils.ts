import {
    COLORS,
    DIGITS,
    DIGIT_SPACING,
    FIXED_COLS,
    FIXED_ROWS,
    TILE_COLS,
    TILE_ROWS,
} from "./notFound.constants.ts";

export function getHoverColor(x: number, y: number): string {
    const index = (x * 7 + y * 13) % COLORS.length;
    return COLORS[index];
}

export function createActiveTiles(): Set<string> {
    const activeTiles = new Set<string>();
    const startCol = Math.floor((FIXED_COLS - (TILE_COLS * 3 + DIGIT_SPACING * 2)) / 2);
    const startRow = Math.floor((FIXED_ROWS - TILE_ROWS) / 2);

    (["4", "0", "4"] as const).forEach((digit, digitIndex) => {
        DIGITS[digit].forEach((row, y) => {
            row.split("").forEach((cell, x) => {
                if (cell === "1") {
                    activeTiles.add(
                        `${startCol + digitIndex * (TILE_COLS + DIGIT_SPACING) + x}-${startRow + y}`,
                    );
                }
            });
        });
    });

    return activeTiles;
}
