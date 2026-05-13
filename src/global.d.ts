declare module '*.module.css' {
    const classes: Record<string, string>;
    export default classes;
}
interface ImportMetaEnv {
    readonly VITE_GATEWAY_BASE_URL?: string;
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_DOCUMENTS_API_BASE_URL?: string;
    readonly VITE_SITE_URL?: string;
    readonly VITE_START_FRONTEND_URL?: string;
    readonly VITE_POST_AUTH_REDIRECT_URL?: string;
    readonly VITE_ENABLE_REMOTE_DOCS?: string;
    readonly VITE_BYPASS_AUTH?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare type IconElement = {
    el: 'path' | 'rect' | 'circle' | 'ellipse';
} & import('react').SVGAttributes<SVGElement>;

declare interface IconData {
    vb: string;
    g: IconElement[];
}

declare interface Window {
    __APP_STORE__?: import("@app/store/store").store;
}
