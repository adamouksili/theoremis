// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Entry Point & Router
// ─────────────────────────────────────────────────────────────

import './styles/index.css';
import './styles/landing.css';
import './styles/api-docs.css';
import './styles/classroom.css';
import './styles/playground.css';
import { initApp, loadSharedProof } from './ide/app';
import { landingShell, bindLanding, stopTypingAnimation } from './ide/landing';
import { apiDocsShell } from './ide/api-docs';
import { classroomShell, bindClassroom } from './ide/classroom';
import { playgroundShell, bindPlayground } from './ide/playground';

type View = 'landing' | 'ide' | 'api' | 'classroom' | 'playground';
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

/** Show API documentation */
function showApiDocs(): void {
  stopTypingAnimation();
  currentView = 'api';
  window.location.hash = 'api';
  document.body.classList.add('dark'); // API docs use dark theme
  const app = document.getElementById('app')!;
  app.innerHTML = apiDocsShell();
}

/** Show Classroom / Grader */
function showClassroom(): void {
  stopTypingAnimation();
  currentView = 'classroom';
  window.location.hash = 'classroom';
  document.body.classList.add('dark');
  const app = document.getElementById('app')!;
  app.innerHTML = classroomShell();
  bindClassroom();
}

/** Show Playground (minimal hypothesis linter) */
function showPlayground(): void {
  stopTypingAnimation();
  currentView = 'playground';
  window.location.hash = 'playground';
  document.body.classList.add('dark');
  const app = document.getElementById('app')!;
  app.innerHTML = playgroundShell();
  bindPlayground();
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
  } else if (hash === 'api') {
    showApiDocs();
  } else if (hash === 'classroom') {
    showClassroom();
  } else if (hash === 'playground') {
    showPlayground();
  } else {
    showLanding();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  route();
});

window.addEventListener('hashchange', route);
