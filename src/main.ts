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

/** Check if we're on a subdomain (not the main site) */
function isSubdomain(): boolean {
  const host = window.location.hostname;
  return host === 'playground.theoremis.com'
      || host === 'api.theoremis.com'
      || host === 'classroom.theoremis.com'
      || host === 'ide.theoremis.com';
}

/** Render landing page */
function showLanding(): void {
  currentView = 'landing';
  if (!isSubdomain()) window.location.hash = '';
  document.body.classList.add('dark'); // Landing is always dark
  const app = document.getElementById('app')!;
  app.innerHTML = landingShell();
  bindLanding(navigateToIDE);
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

/** Navigate to IDE */
function navigateToIDE(): void {
  if (currentView === 'ide') return;
  stopTypingAnimation();
  currentView = 'ide';
  if (!isSubdomain()) window.location.hash = 'ide';
  document.body.classList.remove('dark'); // IDE starts in light mode
  initApp();
}

/** Show API documentation */
function showApiDocs(): void {
  if (currentView === 'api') return;
  stopTypingAnimation();
  currentView = 'api';
  if (!isSubdomain()) window.location.hash = 'api';
  document.body.classList.add('dark'); // API docs use dark theme
  const app = document.getElementById('app')!;
  app.innerHTML = apiDocsShell();
  bindHamburger();
}

/** Show Classroom / Grader */
function showClassroom(): void {
  if (currentView === 'classroom') return;
  stopTypingAnimation();
  currentView = 'classroom';
  if (!isSubdomain()) window.location.hash = 'classroom';
  document.body.classList.add('dark');
  const app = document.getElementById('app')!;
  app.innerHTML = classroomShell();
  bindClassroom();
  bindHamburger();
}

/** Show Playground (minimal hypothesis linter) */
function showPlayground(): void {
  if (currentView === 'playground') return;
  stopTypingAnimation();
  currentView = 'playground';
  if (!isSubdomain()) window.location.hash = 'playground';
  document.body.classList.add('dark');
  const app = document.getElementById('app')!;
  app.innerHTML = playgroundShell();
  bindPlayground();
  bindHamburger();
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

/** Handle hash-based routing (also handles subdomain detection) */
function route(): void {
  const hash = window.location.hash.replace('#', '');
  const host = window.location.hostname;

  // Subdomain detection — always takes priority over hash routing
  if (host === 'playground.theoremis.com') { showPlayground(); return; }
  if (host === 'api.theoremis.com') { showApiDocs(); return; }
  if (host === 'classroom.theoremis.com') { showClassroom(); return; }
  if (host === 'ide.theoremis.com') { navigateToIDE(); return; }

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
