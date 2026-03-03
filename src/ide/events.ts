import { exportAnnotatedLaTeX } from '../emitters/annotated-latex';
import { renderTutorialPanel } from './tutorials';
import { $, S } from './state';
import { renderAxiomBudget, setRunCallback } from './render/axioms';
import { initResizeHandles, renderKaTeXPreview, toggleDarkMode } from './layout-shell';
import { refreshBridgeStatus } from './lean-verify';
import type { IdePipelineController } from './pipeline-run';

function downloadAnnotatedLaTeX() {
    if (!S.ir || !S.tc) return;
    const annotated = exportAnnotatedLaTeX(S.source, S.ir, S.tc, S.lean4, S.report);
    const blob = new Blob([annotated], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotated.tex';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function shareCurrentProof(): void {
    const source = S.source.trim();
    if (!source) return;
    try {
        const encoded = btoa(unescape(encodeURIComponent(source)));
        const url = `${window.location.origin}/#p/${encoded}`;
        navigator.clipboard.writeText(url).then(() => {
            const btn = $('btn-share');
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            btn.classList.add('btn-success');
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove('btn-success');
            }, 2000);
        }).catch(() => {
            window.prompt('Copy this shareable link:', url);
        });
    } catch {
        // Ignore encoding errors.
    }
}

function toggleTutorialPanel(): void {
    const overlay = $('tutorial-overlay');
    const panel = $('tutorial-panel');
    const isVisible = overlay.style.display === 'flex';

    if (isVisible) {
        overlay.style.display = 'none';
    } else {
        overlay.style.display = 'flex';
        renderTutorialPanel(panel);
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
    }, { once: true });
}

export function bindIdeEvents(
    controller: IdePipelineController,
    runLeanVerify: () => Promise<void>,
): void {
    const ed = $<HTMLTextAreaElement>('editor');
    ed.addEventListener('input', () => {
        S.source = ed.value;
        controller.debouncedRun();
        renderKaTeXPreview(ed.value);
    });

    $('btn-sample').addEventListener('click', () => controller.loadSample());
    $('btn-verify').addEventListener('click', () => { void controller.run(); });
    $('btn-download').addEventListener('click', () => controller.downloadOutput());
    $('btn-lean').addEventListener('click', () => { void runLeanVerify(); });
    $('btn-export-annotated').addEventListener('click', downloadAnnotatedLaTeX);
    $('btn-share').addEventListener('click', shareCurrentProof);
    $('btn-learn').addEventListener('click', toggleTutorialPanel);
    $('btn-dark').addEventListener('click', toggleDarkMode);

    window.addEventListener('tutorial-start', ((e: CustomEvent) => {
        const tutorial = e.detail?.tutorial;
        if (tutorial?.latexSource) {
            const editor = $<HTMLTextAreaElement>('editor');
            editor.value = tutorial.latexSource;
            S.source = tutorial.latexSource;
            void controller.run();
            renderKaTeXPreview(tutorial.latexSource);
            $('tutorial-overlay').style.display = 'none';
        }
    }) as EventListener);

    const fileInput = $<HTMLInputElement>('file-input');
    $('btn-upload').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            ed.value = text;
            S.source = text;
            void controller.run();
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    const keyInput = $<HTMLInputElement>('llm-key');
    const modelSelect = $<HTMLSelectElement>('llm-model');
    const storedKey = sessionStorage.getItem('sigma-llm-key');
    const storedModel = sessionStorage.getItem('sigma-llm-model');
    if (storedKey) keyInput.value = storedKey;
    if (storedModel) modelSelect.value = storedModel;
    keyInput.addEventListener('change', () => {
        sessionStorage.setItem('sigma-llm-key', keyInput.value.trim());
    });
    modelSelect.addEventListener('change', () => {
        sessionStorage.setItem('sigma-llm-model', modelSelect.value);
    });

    renderAxiomBudget();
    setRunCallback(controller.run);
    initResizeHandles();

    document.addEventListener('keydown', (e: KeyboardEvent) => {
        const meta = e.metaKey || e.ctrlKey;
        if (meta && e.key === 'Enter') {
            e.preventDefault();
            void controller.run();
        }
        if (meta && e.key === 's') {
            e.preventDefault();
            controller.downloadOutput();
        }
    });

    void refreshBridgeStatus();
}
