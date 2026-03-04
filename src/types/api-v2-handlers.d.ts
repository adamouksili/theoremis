declare module '*api/v2/verify.js' {
    const handler: (req: unknown, res: unknown) => unknown | Promise<unknown>;
    export default handler;
}

declare module '*api/v2/health.js' {
    const handler: (req: unknown, res: unknown) => unknown | Promise<unknown>;
    export default handler;
}

declare module '*api/v2/translate/latex.js' {
    const handler: (req: unknown, res: unknown) => unknown | Promise<unknown>;
    export default handler;
}

declare module '*api/v2/jobs/[id].js' {
    const handler: (req: unknown, res: unknown) => unknown | Promise<unknown>;
    export default handler;
}
