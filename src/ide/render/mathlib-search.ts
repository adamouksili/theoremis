// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Mathlib Search Panel
// Natural language search across Mathlib via Moogle/LeanSearch
// ─────────────────────────────────────────────────────────────

import { $, esc } from '../state';
import { searchMathlib, type MoogleResult } from '../../bridge/moogle-search';

let searchResults: MoogleResult[] = [];
let isSearching = false;

export function renderMathlibSearch(): void {
    const body = $('mathlib-body');
    if (!body) return;

    let html = `<div class="mathlib-search-bar" style="display:flex;gap:4px;margin-bottom:8px">
        <input type="text" id="mathlib-query" placeholder="Search Mathlib… e.g. 'prime number theorem'" 
            style="flex:1;font-size:11px;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-family:var(--font-sans)"
        />
        <button class="btn btn-sm" id="mathlib-search-btn" style="font-size:10px;padding:3px 8px">Search</button>
    </div>`;

    if (isSearching) {
        html += `<div style="font-size:11px;color:var(--text-muted);padding:4px">Searching Mathlib…</div>`;
    } else if (searchResults.length > 0) {
        for (const result of searchResults) {
            html += `<div class="mathlib-result" style="padding:6px 4px;border-bottom:1px solid var(--border);cursor:pointer" data-name="${esc(result.name)}">
                <div style="font-size:11px;font-weight:600;color:var(--accent);font-family:var(--font-mono)">${esc(result.name)}</div>
                <div style="font-size:10px;color:var(--text-secondary);font-family:var(--font-mono);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(result.type)}</div>
                ${result.module ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">📦 ${esc(result.module)}</div>` : ''}
                ${result.docstring ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;line-height:1.3">${esc(result.docstring.slice(0, 120))}${result.docstring.length > 120 ? '…' : ''}</div>` : ''}
            </div>`;
        }
    } else {
        html += `<div style="font-size:11px;color:var(--text-muted);padding:4px">
            Search Mathlib by natural language. Try:
            <ul style="margin:4px 0 0 12px;font-size:10px">
                <li>"addition is commutative"</li>
                <li>"prime factorization"</li>
                <li>"intermediate value theorem"</li>
            </ul>
        </div>`;
    }

    body.innerHTML = html;

    // Bind search actions
    const queryInput = document.getElementById('mathlib-query') as HTMLInputElement | null;
    const searchBtn = document.getElementById('mathlib-search-btn');

    if (searchBtn && queryInput) {
        searchBtn.addEventListener('click', () => doSearch(queryInput.value));
        queryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch(queryInput.value);
        });
    }

    // Click result to copy to clipboard
    body.querySelectorAll('.mathlib-result').forEach(el => {
        el.addEventListener('click', () => {
            const name = (el as HTMLElement).dataset.name!;
            navigator.clipboard.writeText(name).then(() => {
                const origBg = (el as HTMLElement).style.background;
                (el as HTMLElement).style.background = 'var(--success-light)';
                setTimeout(() => { (el as HTMLElement).style.background = origBg; }, 800);
            }).catch(() => { /* ignore */ });
        });
    });
}

async function doSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) return;

    isSearching = true;
    renderMathlibSearch();

    try {
        searchResults = await searchMathlib(trimmed);
    } catch {
        searchResults = [];
    }

    isSearching = false;
    renderMathlibSearch();
}
