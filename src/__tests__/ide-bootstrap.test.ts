import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const bindIdeEvents = vi.fn();
    const runLeanVerify = vi.fn();
    const run = vi.fn(async () => {});
    const loadSample = vi.fn();
    const controller = {
        run,
        debouncedRun: vi.fn(),
        setStatus: vi.fn(),
        clearResults: vi.fn(),
        downloadOutput: vi.fn(),
        loadSample,
    };
    const shell = vi.fn(() => '<div id="shell">IDE</div>');
    const createPipelineController = vi.fn(() => controller);
    const editor = { value: '' } as { value: string };
    const state = { source: '' };
    return {
        bindIdeEvents,
        runLeanVerify,
        run,
        loadSample,
        controller,
        shell,
        createPipelineController,
        editor,
        state,
    };
});

vi.mock('../ide/layout-shell', () => ({ shell: mocks.shell }));
vi.mock('../ide/pipeline-run', () => ({ createPipelineController: mocks.createPipelineController }));
vi.mock('../ide/events', () => ({ bindIdeEvents: mocks.bindIdeEvents }));
vi.mock('../ide/lean-verify', () => ({ runLeanVerify: mocks.runLeanVerify }));
vi.mock('../ide/state', () => ({
    S: mocks.state,
    $: (id: string) => {
        if (id === 'editor') return mocks.editor;
        throw new Error(`unknown selector ${id}`);
    },
}));

import { initApp, loadSharedProof } from '../ide/bootstrap';

describe('ide bootstrap boundaries', () => {
    beforeEach(() => {
        const app = { innerHTML: '' };
        (globalThis as { document: unknown }).document = {
            getElementById: (id: string) => (id === 'app' ? app : null),
        } as unknown as Document;
        if (typeof globalThis.atob !== 'function') {
            (globalThis as { atob: (value: string) => string }).atob = (value: string) =>
                Buffer.from(value, 'base64').toString('binary');
        }
        mocks.editor.value = '';
        mocks.state.source = '';
        mocks.run.mockClear();
        mocks.loadSample.mockClear();
        mocks.bindIdeEvents.mockClear();
        mocks.runLeanVerify.mockClear();
        mocks.shell.mockClear();
        mocks.createPipelineController.mockClear();
    });

    it('initializes shell and bindings once', () => {
        initApp();
        expect(mocks.shell).toHaveBeenCalledTimes(1);
        expect(mocks.createPipelineController).toHaveBeenCalledTimes(1);
        expect(mocks.bindIdeEvents).toHaveBeenCalledTimes(1);
        expect(mocks.loadSample).toHaveBeenCalledTimes(1);
    });

    it('loads shared proof into editor and triggers pipeline run', () => {
        initApp();
        const encoded = Buffer.from('For all x, x = x.', 'utf8').toString('base64');
        loadSharedProof(encoded);

        expect(mocks.editor.value).toBe('For all x, x = x.');
        expect(mocks.state.source).toBe('For all x, x = x.');
        expect(mocks.run).toHaveBeenCalledTimes(1);
    });
});
