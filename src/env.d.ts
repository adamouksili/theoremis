/// <reference types="vite/client" />

declare module '*.css' {
    const content: string;
    export default content;
}

interface ImportMetaEnv {
    readonly VITE_THEOREMIS_BRIDGE_URL?: string;
}
