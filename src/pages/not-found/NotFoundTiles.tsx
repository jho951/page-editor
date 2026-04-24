import React from "react";

import {
    FIXED_COLS,
    FIXED_ROWS,
    MAX_TILE_WIDTH,
    PADDING,
    TILE_HEIGHT,
} from "./notFound.constants.ts";
import { createActiveTiles, getHoverColor } from "./notFound.utils.ts";
import styles from "./NotFoundView.module.css";

function NotFoundTiles(): React.ReactElement {
    const activeTiles = createActiveTiles();
    const svgWidth = FIXED_COLS * MAX_TILE_WIDTH;
    const svgHeight = FIXED_ROWS * TILE_HEIGHT;

    return (
        <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className={styles.svg}
        >
            {Array.from({ length: FIXED_ROWS }).map((_, y) =>
                Array.from({ length: FIXED_COLS }).map((__, x) => (
                    <rect
                        key={`${x}-${y}`}
                        x={x * MAX_TILE_WIDTH + PADDING / 2}
                        y={y * TILE_HEIGHT + PADDING / 2}
                        width={MAX_TILE_WIDTH - PADDING}
                        height={TILE_HEIGHT - PADDING}
                        rx={(MAX_TILE_WIDTH - PADDING) * 0.2}
                        style={{ ["--hover-color" as string]: getHoverColor(x, y) }}
                        className={`${styles.tile} ${activeTiles.has(`${x}-${y}`) ? styles.active : styles.inactive}`}
                    />
                )),
            )}
        </svg>
    );
}

export { NotFoundTiles };
