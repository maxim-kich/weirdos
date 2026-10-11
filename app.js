import { snippets } from './snippets.js';

const downloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const gallery = document.querySelector('#gallery');
const viewer = document.querySelector('#viewer');
const stage = document.querySelector('#viewer-stage');
const viewerTitle = document.querySelector('#viewer-title');
const viewerDownload = document.querySelector('#viewer-download');
const feedback = document.querySelector('#feedback');
let activeSnippet;
let trigger;
let feedbackTimer;
let activeCard;
let modalAnimation;
let modalPhase = 'closed';
let savedScroll = 0;
let previewFrame;
let liveFrame;
let sceneSize;

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

function sceneTransform(rect) {
  return `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / sceneSize.width})`;
}

function modalSceneBounds() {
  const padding = innerWidth <= 767 ? 16 : 40;
  const toolbar = 56;
  const scale = Math.min((innerWidth - padding * 2) / sceneSize.width, (innerHeight - padding * 2 - toolbar) / sceneSize.height);
  const width = sceneSize.width * scale;
  const height = sceneSize.height * scale;
  const left = (innerWidth - width) / 2;
  const top = (innerHeight - height - toolbar) / 2 + toolbar;
  const header = document.querySelector('.viewer-header');
  Object.assign(header.style, { left: `${left}px`, top: `${top - toolbar}px`, width: `${width}px` });
  return { left, top, width, height };
}

function moveFrame(parent, frame) {
  // moveBefore preserves the iframe document and avoids a flash while moving it.
  if (parent.moveBefore && frame.isConnected) parent.moveBefore(frame, null);
  else parent.append(frame);
}

function animateModal(from, to, duration = 420) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  modalAnimation = stage.animate(
    [{ transform: from }, { transform: to }],
    { duration: reducedMotion ? 0 : duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' },
  );
  return modalAnimation;
}

function createFrame(snippet, interactive = false) {
  const frame = document.createElement('iframe');
  frame.title = `${snippet.title} ${interactive ? 'interactive preview' : 'thumbnail'}`;
  frame.setAttribute('sandbox', interactive ? 'allow-scripts' : '');
  const source = !interactive && snippet.previewSrc ? snippet.previewSrc : snippet.src;
  if (source) {
    const url = new URL(source, location.href);
    if (interactive && snippet.transitionPose) url.searchParams.set('pose', 'preview');
    frame.src = url.href;
  }
  else frame.srcdoc = snippet.code;
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

function requestPose(pose) {
  if (activeSnippet?.transitionPose && viewer.hasAttribute('data-live-ready')) {
    liveFrame.contentWindow.postMessage({ type: 'weirdos:pose', pose }, '*');
  }
}

async function openSnippet(snippet, button) {
  if (modalPhase !== 'closed') return;
  modalPhase = 'opening';
  activeSnippet = snippet;
  trigger = button;
  activeCard = button.closest('.snippet');
  const shot = activeCard.querySelector('.shot');
  const origin = shot.getBoundingClientRect();
  sceneSize = { width: origin.width, height: origin.height };
  lockScroll();
  viewerTitle.textContent = snippet.title;
  viewerTitle.title = snippet.title;
  viewerDownload.innerHTML = downloadIcon;
  viewerDownload.setAttribute('aria-label', `Download ${snippet.title} ZIP`);
  previewFrame = shot.querySelector('iframe');
  previewFrame.classList.add('preview-layer');
  liveFrame = createFrame(snippet, true);
  liveFrame.classList.add('live-layer');
  liveFrame.inert = true;
  viewer.toggleAttribute('data-pose-bridge', Boolean(snippet.transitionPose));
  delete viewer.dataset.liveReady;
  Object.assign(stage.style, { width: `${sceneSize.width}px`, height: `${sceneSize.height}px` });
  stage.replaceChildren(liveFrame);
  delete viewer.dataset.closing;
  viewer.dataset.phase = 'opening';
  viewer.showModal();
  moveFrame(stage, previewFrame);
  activeCard.classList.add('is-expanded');
  const destination = sceneTransform(modalSceneBounds());
  stage.style.transform = destination;
  const animation = animateModal(sceneTransform(origin), destination, 240);
  viewer.focus();
  try {
    await animation.finished;
    if (modalPhase === 'opening' && modalAnimation === animation) {
      stage.style.transform = destination;
      animation.cancel();
      modalPhase = 'open';
      viewer.dataset.phase = 'open';
      liveFrame.inert = false;
      requestPose('idle');
      document.querySelector('#viewer-close').focus();
    }
  } catch { /* Closing can interrupt expansion. */ }
}

for (const snippet of snippets) {
  const card = document.createElement('article');
  card.className = 'snippet';
  const shot = document.createElement('button');
  shot.type = 'button';
  shot.className = 'shot';
  shot.setAttribute('aria-label', `Open ${snippet.title}`);
  shot.setAttribute('aria-haspopup', 'dialog');
  shot.append(createFrame(snippet));
  shot.addEventListener('click', () => openSnippet(snippet, shot));

  const row = document.createElement('div');
  row.className = 'title-row';
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'title-button';
  title.title = snippet.title;
  title.setAttribute('aria-haspopup', 'dialog');
  const label = document.createElement('span');
  label.textContent = snippet.title;
  title.append(label);
  title.addEventListener('click', () => openSnippet(snippet, title));
  row.append(title);
  card.append(shot, row);
  card.addEventListener('click', (event) => {
    if (!event.target.closest('button')) openSnippet(snippet, shot);
  });
  gallery.append(card);
}

viewerDownload.innerHTML = downloadIcon;
viewerDownload.addEventListener('click', () => { if (activeSnippet) downloadSnippet(activeSnippet); });
function cleanupPreview() {
  if (viewer.open || !activeSnippet) return;
  previewFrame.classList.remove('preview-layer');
  moveFrame(activeCard.querySelector('.shot'), previewFrame);
  stage.replaceChildren();
  stage.removeAttribute('style');
  previewFrame = undefined;
  liveFrame = undefined;
  sceneSize = undefined;
  delete feedback.dataset.visible;
  document.body.append(feedback);
  activeCard?.classList.remove('is-expanded');
  activeCard = undefined;
  activeSnippet = undefined;
  modalPhase = 'closed';
  delete viewer.dataset.closing;
  delete viewer.dataset.phase;
  delete viewer.dataset.poseBridge;
  delete viewer.dataset.liveReady;
  unlockScroll();
  trigger?.focus({ preventScroll: true });
}
async function closeSnippet() {
  if (modalPhase === 'closed' || modalPhase === 'closing') return;
  modalPhase = 'closing';
  const current = getComputedStyle(stage).transform;
  modalAnimation?.cancel();
  const origin = activeCard.querySelector('.shot').getBoundingClientRect();
  viewer.dataset.closing = '';
  viewer.dataset.phase = 'closing';
  requestPose('preview');
  liveFrame.inert = true;
  viewer.focus();
  delete feedback.dataset.visible;
  const animation = animateModal(current, sceneTransform(origin));
  try { await animation.finished; } catch { /* An external dismissal can cancel motion. */ }
  viewer.close();
  animation.cancel();
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
  if (event.data?.type === 'weirdos:ready' && activeSnippet?.transitionPose) {
    viewer.dataset.liveReady = '';
    if (modalPhase === 'open') requestPose('idle');
  }
});
window.addEventListener('resize', () => {
  if (modalPhase === 'open') stage.style.transform = sceneTransform(modalSceneBounds());
});
