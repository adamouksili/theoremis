// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Entry Point & Router
// ─────────────────────────────────────────────────────────────

import './styles/index.css';
import './styles/landing.css';

type View = 'landing' | 'ide' | 'api' | 'playground';
let currentView: View = 'landing';
let routeToken = 0;

/** Check if we're on a subdomain (not the main site) */
function isSubdomain(): boolean {
    const host = window.location.hostname;
    return host === 'playground.theoremis.com'
        || host === 'api.theoremis.com'
        || host === 'ide.theoremis.com';
}

/** Bind mobile hamburger menu on any page that has it */
function bindHamburger(): void {
    const hamburger = document.getElementById('nav-hamburger');
    const navLinks = document.querySelector('.landing-nav-links') as HTMLElement | null;
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            hamburger.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
        });
    }
}

async function stopLandingTyping(): Promise<void> {
    const landing = await import('./ide/landing');
    landing.stopTypingAnimation();
}

/** Render landing page */
async function showLanding(): Promise<void> {
    const token = ++routeToken;
    currentView = 'landing';
    if (!isSubdomain()) window.location.hash = '';
    document.body.classList.add('dark'); // Landing is always dark

    const landing = await import('./ide/landing');
    if (token !== routeToken) return;

    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = landing.landingShell();
    landing.bindLanding(() => { void navigateToIDE(); });
}

/** Navigate to IDE */
async function navigateToIDE(): Promise<void> {
    if (currentView === 'ide') return;

    const token = ++routeToken;
    const previousView = currentView;
    await stopLandingTyping();
    if (token !== routeToken) return;

    currentView = 'ide';
    if (!isSubdomain()) window.location.hash = 'ide';
    document.body.classList.add('dark');

    try {
        const ide = await import('./ide/app');
        if (token !== routeToken) return;
        ide.initApp();
    } catch {
        currentView = previousView;
    }
}

/** Show API documentation */
async function showApiDocs(): Promise<void> {
    if (currentView === 'api') return;

    const token = ++routeToken;
    const previousView = currentView;
    await stopLandingTyping();
    if (token !== routeToken) return;

    currentView = 'api';
    if (!isSubdomain()) window.location.hash = 'api';

    try {
        await import('./styles/api-docs.css');
        if (token !== routeToken) return;

        const apiDocs = await import('./ide/api-docs');
        if (token !== routeToken) return;

        document.body.classList.add('dark');
        const app = document.getElementById('app');
        if (!app) return;
        app.innerHTML = apiDocs.apiDocsShell();
        bindHamburger();
    } catch {
        currentView = previousView;
    }
}

/** Show Playground (minimal hypothesis linter) */
async function showPlayground(): Promise<void> {
    if (currentView === 'playground') return;

    const token = ++routeToken;
    const previousView = currentView;
    await stopLandingTyping();
    if (token !== routeToken) return;

    currentView = 'playground';
    if (!isSubdomain()) window.location.hash = 'playground';

    try {
        await import('./styles/playground.css');
        if (token !== routeToken) return;

        const playground = await import('./ide/playground');
        if (token !== routeToken) return;

        document.body.classList.add('dark');
        const app = document.getElementById('app');
        if (!app) return;
        app.innerHTML = playground.playgroundShell();
        playground.bindPlayground();
        bindHamburger();
    } catch {
        currentView = previousView;
    }
}

/** Navigate to IDE with shared proof content */
async function navigateToSharedProof(base64: string): Promise<void> {
    const token = ++routeToken;
    await stopLandingTyping();
    if (token !== routeToken) return;

    currentView = 'ide';
    document.body.classList.add('dark');

    const ide = await import('./ide/app');
    if (token !== routeToken) return;

    ide.initApp();
    requestAnimationFrame(() => ide.loadSharedProof(base64));
}

/** Handle hash-based routing (also handles subdomain detection) */
async function route(): Promise<void> {
    const hash = window.location.hash.replace('#', '');
    const host = window.location.hostname;

    // Subdomain routing takes priority over hash routing.
    if (host === 'playground.theoremis.com') { await showPlayground(); return; }
    if (host === 'api.theoremis.com') { await showApiDocs(); return; }
    if (host === 'ide.theoremis.com') { await navigateToIDE(); return; }

    if (hash.startsWith('p/')) {
        const base64 = hash.slice(2);
        if (currentView === 'ide') {
            const ide = await import('./ide/app');
            ide.loadSharedProof(base64);
        } else {
            await navigateToSharedProof(base64);
        }
        return;
    }

    if (hash === 'ide') { await navigateToIDE(); return; }
    if (hash === 'api') { await showApiDocs(); return; }
    if (hash === 'playground') { await showPlayground(); return; }

    await showLanding();
}

document.addEventListener('DOMContentLoaded', () => {
    void route();
});

window.addEventListener('hashchange', () => {
    void route();
});
