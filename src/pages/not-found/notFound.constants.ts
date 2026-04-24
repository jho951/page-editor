export const FIXED_COLS = 30;
export const FIXED_ROWS = 15;
export const MAX_TILE_WIDTH = 54;
export const ASPECT_RATIO = 38 / 32;
export const TILE_COLS = 4;
export const TILE_ROWS = 7;
export const DIGIT_SPACING = 2;
export const PADDING = 6;
export const TILE_HEIGHT = MAX_TILE_WIDTH * ASPECT_RATIO;

export const DIGITS: Record<"4" | "0", string[]> = {
    "4": ["1001", "1001", "1001", "1111", "0001", "0001", "0001"],
    "0": ["0110", "1001", "1001", "1001", "1001", "1001", "0110"],
};

export const COLORS = [
    "#FF6B6B",
    "#FFD93D",
    "#6BCB77",
    "#4D96FF",
    "#B197FC",
    "#F06595",
    "#20C997",
    "#FAB005",
    "#FF922B",
    "#845EF7",
    "#339AF0",
    "#51CF66",
    "#FCC419",
    "#FF8787",
    "#94D82D",
    "#EEBEFA",
    "#A5D8FF",
    "#FFD8A8",
];
