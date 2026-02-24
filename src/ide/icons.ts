// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Professional SVG Icons
// Replaces emoji with clean, consistent inline SVG icons
// ─────────────────────────────────────────────────────────────

/** Create an inline SVG string with consistent sizing. */
function svg(paths: string, size = 14, viewBox = '0 0 24 24'): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle">${paths}</svg>`;
}

// ── Status icons ────────────────────────────────────────────

/** Checkmark circle — verification passed */
export const iconCheck = svg(
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
);

/** Warning triangle — needs attention */
export const iconWarn = svg(
    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
);

/** X circle — error / unverified */
export const iconError = svg(
    '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
);

/** Dash circle — idle / ready */
export const iconIdle = svg(
    '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>'
);

// ── Theme icons ─────────────────────────────────────────────

/** Sun — light mode */
export const iconSun = svg(
    '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
);

/** Moon — dark mode */
export const iconMoon = svg(
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
);

// ── Action icons ────────────────────────────────────────────

/** Sparkles — AI suggestion */
export const iconSparkles = svg(
    '<path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/>'
);

/** X — close button */
export const iconClose = svg(
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
);

/** Shield check — verified */
export const iconShieldCheck = svg(
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'
);

// ── Canvas-friendly text icons (for non-HTML contexts) ──────

export const textIcons = {
    verified: '\u2713',  // ✓
    partial: '\u26A0',   // ⚠ (rendered in monospace, not emoji)
    unverified: '\u2717', // ✗
    check: '\u2713',
    cross: '\u2717',
    unknown: '?',
} as const;
