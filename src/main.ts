// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Entry Point & Router
// ─────────────────────────────────────────────────────────────

import './styles/index.css';
import './styles/landing.css';
import { initApp, loadSharedProof } from './ide/app';
import { landingShell, bindLanding, stopTypingAnimation } from './ide/landing';

type View = 'landing' | 'ide';
let currentView: View = 'landing';

/** Render landing page */
function showLanding(): void {
  currentView = 'landing';
  window.location.hash = '';
  document.body.classList.add('dark'); // Landing is always dark
  const app = document.getElementById('app')!;
  app.innerHTML = landingShell();
  bindLanding(navigateToIDE);
}

/** Navigate to IDE */
function navigateToIDE(): void {
  if (currentView === 'ide') return;
  stopTypingAnimation();
  currentView = 'ide';
  window.location.hash = 'ide';
  document.body.classList.remove('dark'); // IDE starts in light mode
  initApp();
}

/** Navigate to IDE with shared proof content */
function navigateToSharedProof(base64: string): void {
  stopTypingAnimation();
  currentView = 'ide';
  document.body.classList.remove('dark');
  initApp();
  // Small delay to let the DOM render before loading content
  requestAnimationFrame(() => loadSharedProof(base64));
}

/** Handle hash-based routing */
function route(): void {
  const hash = window.location.hash.replace('#', '');
  if (hash.startsWith('p/')) {
    // Shared proof URL: #p/BASE64ENCODED
    const base64 = hash.slice(2);
    if (currentView === 'ide') {
      loadSharedProof(base64);
    } else {
      navigateToSharedProof(base64);
    }
  } else if (hash === 'ide') {
    navigateToIDE();
  } else {
    showLanding();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  route();
});

window.addEventListener('hashchange', route);
