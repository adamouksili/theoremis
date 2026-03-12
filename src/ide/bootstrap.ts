import { shell } from './layout-shell';
import { $, S } from './state';
import { bindIdeEvents } from './events';
import { createPipelineController, type IdePipelineController } from './pipeline-run';

let controller: IdePipelineController | null = null;

export function initApp() {
    document.getElementById('app')!.innerHTML = shell();
    controller = createPipelineController();
    bindIdeEvents(controller);
    controller.loadSample();
}

export function loadSharedProof(base64: string): void {
    if (!controller) return;
    try {
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        const ed = $<HTMLTextAreaElement>('editor');
        ed.value = decoded;
        S.source = decoded;
        void controller.run();
    } catch {
        const ed = $<HTMLTextAreaElement>('editor');
        if (ed) ed.value = '% Failed to load shared proof (invalid link)';
    }
}
