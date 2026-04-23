import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
    plugins: [
        react(),
        tsconfigPaths()
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    server: {
        host: true,
        port: Number(process.env.VITE_PORT ?? 3000),
        proxy: {
            "/v1": {
                target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8080",
                changeOrigin: true,
            },
            "/auth": {
                target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8080",
                changeOrigin: true,
            },
        },
    },
});
