import { snippets } from './snippets.js';

const downloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const desktopIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4" stroke-linecap="round"/></svg>';
const mobileIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4" stroke-linecap="round"/></svg>';
const mobileDevice = matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');
const logo = document.querySelector('.ascii-logo');
logo.replaceChildren(...Array.from(logo.textContent, character => {
  if (character === '\n') return document.createTextNode(character);
  const cell = document.createElement('span');
  cell.textContent = character;
  return cell;
}));
const gallery = document.querySelector('#gallery');
const viewer = document.querySelector('#viewer');
const stage = document.querySelector('#viewer-stage');
const viewerTitle = document.querySelector('#viewer-title');
const viewerDownload = document.querySelector('#viewer-download');
const viewerRestart = document.querySelector('#viewer-restart');
const viewerShare = document.querySelector('#viewer-share');
const cardButtons = new Map();
let pendingRoute = false;
const feedback = document.querySelector('#feedback');
let activeSnippet;
let trigger;
let feedbackTimer;
let modalPhase = 'closed';
let savedScroll = 0;
let liveFrame;
let liveLoaded = false;
let liveRendered = false;
let modalAnimation;
let session = 0;
let shellAnimations = [];
let modalOffset = { x: 0, y: 0 };
const header = document.querySelector('.viewer-header');

function lockScroll() {
  savedScroll = window.scrollY;
  document.body.style.top = `-${savedScroll}px`;
  document.documentElement.classList.add('modal-open');
}

function unlockScroll() {
  document.documentElement.classList.remove('modal-open');
  document.body.style.top = '';
  window.scrollTo({ top: savedScroll, behavior: 'instant' });
}

function layoutModal() {
  const padding = innerWidth <= 767 ? 16 : 40;
  const toolbar = 56;
  const width = Math.min(innerWidth - padding * 2, Math.max(0, innerHeight - padding * 2 - toolbar) * 4 / 3);
  const height = width * 3 / 4;
  const left = (innerWidth - width) / 2;
  const top = (innerHeight - height - toolbar) / 2 + toolbar;
  Object.assign(stage.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  Object.assign(document.querySelector('.viewer-header').style, { left: `${left}px`, top: `${top - toolbar}px`, width: `${width}px` });
}

function createFrame(snippet, interactive = false) {
  const frame = document.createElement('iframe');
  frame.title = `${snippet.title} ${interactive ? 'interactive preview' : 'thumbnail'}`;
  frame.setAttribute('sandbox', interactive ? 'allow-scripts' : '');
  frame.src = interactive ? snippet.src : snippet.previewSrc;
  if (!interactive) {
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.loading = 'lazy';
    frame.inert = true;
  }
  return frame;
}

function announce(message) {
  clearTimeout(feedbackTimer);
  (viewer.open ? viewer : document.body).append(feedback);
  feedback.textContent = message;
  feedback.dataset.visible = '';
  feedbackTimer = setTimeout(() => { delete feedback.dataset.visible; }, 2400);
}

function downloadSnippet(snippet) {
  const link = document.createElement('a');
  link.href = snippet.download;
  link.download = `${snippet.id}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
}

function previewURL(snippet) {
  const url = new URL(location.href);
  if (snippet) url.searchParams.set('preview', snippet.id);
  else url.searchParams.delete('preview');
  return url;
}

async function copyPreviewLink() {
  if (!activeSnippet) return;
  const url = previewURL(activeSnippet).href;
  try {
    await navigator.clipboard.writeText(url);
    announce('Preview link copied');
  } catch {
    // Fallback for browsers without the Clipboard API or clipboard permission.
    const field = document.createElement('textarea');
    field.value = url;
    field.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    viewer.append(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Show failure below. */ }
    field.remove();
    viewerShare.focus({ preventScroll: true });
    announce(copied ? 'Preview link copied' : 'Could not copy link. Copy the address from your browser.');
  }
}

function syncPreviewURL() {
  const id = new URL(location.href).searchParams.get('preview');
  const snippet = snippets.find(snippet => snippet.id === id);
  if (modalPhase === 'open' && activeSnippet === snippet) return;
  if (modalPhase !== 'closed') {
    pendingRoute = true;
    closeSnippet(false);
    return;
  }
  if (snippet) openSnippet(snippet, cardButtons.get(snippet.id), false);
}

function revealLive() {
  if (modalPhase !== 'open' || !liveLoaded || !liveRendered) return;
  viewer.dataset.ready = '';
  stage.setAttribute('aria-busy', 'false');
  liveFrame.inert = viewer.hasAttribute('data-desktop-only');
}

function loadLive(snippet, token) {
  if (session !== token || modalPhase !== 'open') return;
  const frame = createFrame(snippet, true);
  if (viewer.hasAttribute('data-desktop-only')) {
    const url = new URL(snippet.src, location.href);
    url.searchParams.set('autoDemo', '1');
    frame.src = url.href;
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
  }
  liveFrame = frame;
  frame.classList.add('live-layer');
  frame.inert = true;
  frame.addEventListener('load', () => {
    if (session !== token || frame !== liveFrame) return;
    liveLoaded = true;
    revealLive();
  }, { once: true });
  stage.prepend(frame);
}

function openSnippet(snippet, button, updateURL = true) {
  if (modalPhase !== 'closed') return;
  if (updateURL) history.pushState({ ...history.state, weirdosModal: true }, '', previewURL(snippet));
  const token = ++session;
  modalPhase = 'open';
  activeSnippet = snippet;
  trigger = button;
  liveLoaded = false;
  liveRendered = false;
  liveFrame = undefined;
  const cardBounds = button.closest('.snippet').getBoundingClientRect();
  lockScroll();
  viewerTitle.textContent = snippet.title;
  viewerTitle.title = snippet.title;
  viewerRestart.hidden = !snippet.restart;
  viewerDownload.setAttribute('aria-label', `Download ${snippet.title} ZIP`);
  viewerShare.setAttribute('aria-label', `Copy ${snippet.title} preview link`);
  viewer.toggleAttribute('data-desktop-only', !!snippet.desktopOnly && mobileDevice.matches);
  delete viewer.dataset.ready;
  delete viewer.dataset.closing;
  viewer.dataset.phase = 'open';
  stage.setAttribute('aria-busy', 'true');
  const loader = document.createElement('div');
  loader.className = 'viewer-loader';
  loader.setAttribute('role', 'status');
  loader.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span><span class="loading-label">Loading preview</span>';
  const notice = document.createElement('div');
  notice.className = 'desktop-only-notice';
  notice.innerHTML = `${desktopIcon}<p>This component is desktop only.</p>`;
  stage.replaceChildren(loader, notice);
  if (snippet.mobilePreferred) {
    const hint = document.createElement('p');
    hint.className = 'mobile-preferred-hint';
    hint.textContent = 'Best for mobile';
    stage.append(hint);
  }
  if (snippet.desktopPreferred) {
    const hint = document.createElement('p');
    hint.className = 'desktop-preferred-hint';
    hint.textContent = 'best on desktop';
    stage.append(hint);
  }
  layoutModal();
  viewer.showModal();
  const bounds = stage.getBoundingClientRect();
  modalOffset = { x: Math.max(-16, Math.min(16, (cardBounds.left + cardBounds.width / 2 - bounds.left - bounds.width / 2) * .06)), y: Math.max(-12, Math.min(12, (cardBounds.top + cardBounds.height / 2 - bounds.top - bounds.height / 2) * .06)) };
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160;
  modalAnimation = viewer.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' });
  shellAnimations = [stage, header].map(element => element.animate([{ transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)` }, { transform: 'translate(0, 0)' }], { duration, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
  viewer.focus({ preventScroll: true });
  // Paint the modal and loader before initializing an independent snippet.
  requestAnimationFrame(() => requestAnimationFrame(() => loadLive(snippet, token)));
}

for (const snippet of snippets) {
  const card = document.createElement('article');
  card.className = 'snippet';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card-button';
  cardButtons.set(snippet.id, button);
  button.setAttribute('aria-label', `Open ${snippet.title}, ${snippet.desktopOnly ? 'desktop only' : snippet.desktopPreferred ? 'best on desktop, also works on mobile' : snippet.mobilePreferred ? 'best for mobile, also works on desktop' : 'desktop and mobile'}`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', () => openSnippet(snippet, button));
  button.addEventListener('focusout', () => { delete button.dataset.restoredFocus; });
  const shot = document.createElement('span');
  shot.className = 'shot';
  shot.append(createFrame(snippet));

  const row = document.createElement('span');
  row.className = 'title-row';
  const title = document.createElement('span');
  title.className = 'title-button';
  title.title = snippet.title;
  const label = document.createElement('span');
  label.textContent = snippet.title;
  title.append(label);
  const devices = document.createElement('span');
  devices.className = 'device-icons';
  devices.title = snippet.desktopOnly ? 'Desktop only' : snippet.desktopPreferred ? 'Best on desktop; also works on mobile' : snippet.mobilePreferred ? 'Best for mobile; also works on desktop' : 'Desktop and mobile';
  devices.setAttribute('aria-hidden', 'true');
  devices.innerHTML = (snippet.mobilePreferred ? '' : desktopIcon) + (snippet.desktopOnly || snippet.desktopPreferred ? '' : mobileIcon);
  row.append(title, devices);
  button.append(shot, row);
  card.append(button);
  gallery.append(card);
}

document.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    document.documentElement.dataset.keyboardFocus = '';
    gallery.querySelectorAll('[data-restored-focus]').forEach(button => { delete button.dataset.restoredFocus; });
  }
}, true);
document.addEventListener('pointerdown', () => {
  delete document.documentElement.dataset.keyboardFocus;
}, true);

viewerRestart.addEventListener('click', () => { if (activeSnippet?.restart && liveRendered) liveFrame.contentWindow.postMessage({ type: 'weirdos:restart' }, '*'); });
viewerDownload.innerHTML = downloadIcon;
viewerDownload.addEventListener('click', () => { if (activeSnippet) downloadSnippet(activeSnippet); });
viewerShare.addEventListener('click', copyPreviewLink);
function cleanupPreview() {
  if (viewer.open || !activeSnippet) return;
  ++session;
  shellAnimations.forEach(animation => animation.cancel());
  shellAnimations = [];
  stage.replaceChildren();
  stage.removeAttribute('style');
  stage.removeAttribute('aria-busy');
  liveFrame = undefined;
  activeSnippet = undefined;
  modalPhase = 'closed';
  delete viewer.dataset.closing;
  delete viewer.dataset.desktopOnly;
  delete viewer.dataset.phase;
  delete viewer.dataset.ready;
  delete feedback.dataset.visible;
  document.body.append(feedback);
  unlockScroll();
  if (trigger) {
    trigger.dataset.restoredFocus = '';
    trigger.focus({ preventScroll: true });
  }
  if (pendingRoute) {
    pendingRoute = false;
    syncPreviewURL();
  }
}

async function closeSnippet(updateURL = true) {
  if (modalPhase === 'closed' || modalPhase === 'closing') return;
  modalPhase = 'closing';
  if (updateURL !== false) {
    if (history.state?.weirdosModal) history.back();
    else history.replaceState(history.state, '', previewURL());
  }
  ++session;
  const transforms = [stage, header].map(element => getComputedStyle(element).transform);
  shellAnimations.forEach(animation => animation.cancel());
  const opacity = getComputedStyle(viewer).opacity;
  modalAnimation?.cancel();
  viewer.dataset.closing = '';
  viewer.dataset.phase = 'closing';
  if (liveFrame) liveFrame.inert = true;
  delete feedback.dataset.visible;
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 120;
  modalAnimation = viewer.animate([{ opacity }, { opacity: 0 }], { duration, easing: 'ease-in', fill: 'forwards' });
  shellAnimations = [stage, header].map((element, index) => element.animate([{ transform: transforms[index] }, { transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)` }], { duration, easing: 'ease-in', fill: 'forwards' }));
  try { await modalAnimation.finished; } catch { /* Native dismissal can interrupt the fade. */ }
  viewer.close();
  modalAnimation.cancel();
  cleanupPreview();
}
document.querySelector('#viewer-close').addEventListener('click', closeSnippet);
viewer.addEventListener('click', event => {
  if (event.target === viewer) closeSnippet();
});
viewer.addEventListener('close', cleanupPreview);
viewer.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeSnippet();
});
// Native dialog handles focus trapping and Escape in the host document.
// Snippets may request Escape dismissal from their sandbox without gaining host access.
window.addEventListener('message', (event) => {
  if (!viewer.open || event.source !== liveFrame?.contentWindow) return;
  if (event.data?.type === 'weirdos:close') closeSnippet();
  if (event.data?.type === 'weirdos:ready') {
    liveRendered = true;
    revealLive();
  }
});
window.addEventListener('resize', () => {
  if (modalPhase !== 'closed') layoutModal();
});
mobileDevice.addEventListener('change', () => {
  if (modalPhase !== 'open' || !activeSnippet?.desktopOnly) return;
  ++session;
  liveLoaded = false;
  liveRendered = false;
  delete viewer.dataset.ready;
  viewer.toggleAttribute('data-desktop-only', mobileDevice.matches);
  stage.setAttribute('aria-busy', 'true');
  liveFrame?.remove();
  loadLive(activeSnippet, session);
});
window.addEventListener('popstate', syncPreviewURL);
syncPreviewURL();
