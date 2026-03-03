import { shell } from './layout-shell';
import { $, S } from './state';
import { bindIdeEvents } from './events';
import { runLeanVerify } from './lean-verify';
import { createPipelineController, type IdePipelineController } from './pipeline-run';

let controller: IdePipelineController | null = null;

export function initApp() {
    document.getElementById('app')!.innerHTML = shell();
    controller = createPipelineController();
    bindIdeEvents(controller, async () => {
        await runLeanVerify(controller!.setStatus);
    });
    controller.loadSample();
}

export function loadSharedProof(base64: string): void {
    if (!controller) return;
    try {
        const decoded = decodeURIComponent(escape(atob(base64)));
        const ed = $<HTMLTextAreaElement>('editor');
        ed.value = decoded;
        S.source = decoded;
        void controller.run();
    } catch {
        // Invalid base64 payload.
    }
}
