# Adding a weirdo

The user can drop a folder into this project and ask an agent to add it. The agent handles the steps below. `isSwtchCatDisabled` in `elements/cat-switch/` is the working reference.

## 1. Import the folder

Keep the supplied element's visual design and behavior. Place its working files together:

```text
elements/my-weirdo/
  index.html        interactive, standalone element
  preview.html      static gallery pose
  assets/           local images, fonts, CSS, or JavaScript as needed
```

Rename the supplied entry HTML to `index.html`. Keep all runtime dependencies inside this folder and use relative paths, such as `assets/paw.png`. No references to Downloads, the gallery's CSS, root-relative asset URLs, or files outside the element folder. Opening the extracted ZIP's `index.html` must work without the gallery or a dev server. Avoid module imports or fetching local files if they prevent that direct-file use.

Inspect image dimensions and file sizes. Resize oversized raster assets for their actual rendered size with enough resolution for high-density displays. Preserve transparency, proportions, and the element's displayed size. Keep the supplied originals intact unless the user asks to edit them.

## 2. Build a static preview

`preview.html` shows one recognizable, intentional pose, with no scripts, timers, interaction, or animation. Freeze the element with CSS and static markup. Do not merely show a loading state or an empty idle state if the defining feature would be hidden. The cat switch preview shows the paw gripping the knob.

Keep the preview faithful to the snippet's background and design. Its intentional static pose may differ from the interactive idle pose. The gallery preview stays in its card; it is never moved or stretched into the modal.

A typical centered canvas uses:

```css
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
body { display: grid; place-items: center; }
```

The gallery owns the **4:3** shot ratio. Do not add another frame, card title, download button, or modal toolbar inside the element. Its own visual style is independent of the site's design system.

## 3. Register it

Append one entry to `snippets.js`:

```js
{
  id: 'myWeirdo',
  title: 'myWeirdo', // use the exact name supplied by the user
  src: './elements/my-weirdo/index.html',
  previewSrc: './elements/my-weirdo/preview.html',
  readyMessage: true,
  download: './downloads/myWeirdo.zip',
}
```

Entries support an optional `desktopOnly: true` flag. Cards show desktop/mobile icons by default, or just desktop for flagged entries. On narrow or touch-only devices, desktop-only modals display a notice over an inert, blurred live demo loaded with `?autoDemo=1`. The element owns that demo animation; it should loop through its real interaction and respect reduced motion. Desktop retains the ordinary interactive snippet.

The ID must be unique and contain only letters, numbers, hyphens, or underscores. The ZIP filename and its top-level folder use that ID. The title stays one line and truncates automatically. Adding an ordinary entry should not require editing `app.js`, `styles.css`, or the gallery HTML.

## 4. Shared modal flow

Every weirdo uses the same host behavior:

- The gallery loads only the script-free `preview.html` in a sandboxed, inert iframe.
- Clicking a card opens an independent centered modal with a 160 ms opacity fade and a small translation toward its final position from the clicked card (at most 16 px horizontally and 12 px vertically). The gallery preview remains untouched.
- The modal shows a shared spinner while its separate `index.html` iframe loads and initializes. Its own design runs in its normal standalone idle state, at the modal's actual viewport size.
- Once document loading and the snippet's `weirdos:ready` message are both complete, the real snippet fades in over 160 ms and becomes interactive.
- Closing fades the modal out over 120 ms with the same small directional translation, destroys its interactive iframe, restores scrolling, and returns focus to the trigger without displaying a focus ring. Tab navigation resumes visible focus on the whole card; each card is one button and one tab stop.
- There is no gallery-to-modal geometry morph, preview iframe reparenting, or per-element pose protocol. Do not use `transitionPose`, `?pose=preview`, or `weirdos:pose`.
- Each modal has a shareable gallery URL using `?preview=<id>`. Loading that URL opens the matching modal. The toolbar's share button copies this URL and confirms the copy. Back/Forward follows modal navigation; closing a directly loaded preview returns to the gallery on the same page.

Use native default and pointer cursors for the gallery and interactive controls. Keep the cursor consistent across each control and its children, including its active state. Keep button hit areas stationary while animating visual contents. Decorative SVG/canvas children should not intercept pointer events.

The host preserves the two-column gallery (one on mobile), 4:3 modal canvas with outer padding, separate toolbar, ZIP downloads only in the toolbar, blurred/dimmed backdrop, Escape and outside-click dismissal, focus trapping, and scroll locking. Reduced motion removes the fades and spinner animation. Resize the independent modal viewport normally; never stretch its axes.

## 5. Shared readiness and dismissal contract

Every registry entry uses `readyMessage: true`. Every interactive `index.html` sends one readiness message after all required assets are loaded and its first usable frame has rendered:

```js
if (parent !== window) parent.postMessage({ type: 'weirdos:ready' }, '*');
```

For a DOM-only snippet, wait for document load and the first animation frame. For canvas/WebGL or asynchronous initialization, send readiness after the first successful draw. Do not signal ready for an empty canvas or while required images are still loading. Keep normal standalone interaction; the modal does not request a special starting pose.

Forward Escape from the interactive element:

```js
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && parent !== window) {
    parent.postMessage({ type: 'weirdos:close' }, '*');
  }
});
```

The host validates messages against its current interactive iframe's `contentWindow`, and discards late messages after closing. `'*'` is required by the opaque sandbox origin. Do not add `allow-same-origin`.

## 6. Package and verify before main

Run:

```sh
npm run check
npm run package
npm run dev
```

`check` validates the registry, element paths, local HTML/CSS asset references, static preview rules, and classic inline-script syntax. It does not prove visual or runtime behavior. `package` validates again and builds ZIPs in the ignored `downloads/` directory; `dev` also packages automatically. The gallery-only preview file is excluded from each ZIP. The interactive HTML and assets are included under the element ID.

Before considering the change ready for `main`, verify:

- The gallery shows only registered real elements. Its static preview displays the intended pose and loads all assets.
- At desktop and mobile widths, gallery previews remain static and in their original cards. The independent modal uses only a short fade and bounded translation, without zooming, stretching, or moving the gallery iframe. Its live snippet has its own correctly sized viewport.
- The loader remains visible during delayed loading, and live content appears only after assets and first-render readiness. The modal interaction works repeatedly. Close during the opening fade, loading, content fade, and the element's own animation; late loading must not reopen it.
- The toolbar fades out with the modal. Escape closes from inside the iframe; clicking outside the canvas and toolbar also closes it. Clicking the canvas or its controls must not dismiss it. Keyboard focus returns; there is no persistent card selection.
- Page scrolling stays locked during the modal and its fades. Closing restores the original scroll position. Check reduced motion and viewport resizing.
- The modal's download button retrieves the correct ZIP. Gallery cards have no download icon. Inspect the archive, extract it into a temporary folder, and open its `index.html` directly to test the interaction and asset paths.
- There are no new console errors, missing assets, unrelated changes, or committed generated ZIPs.

Summarize the integration and checks for the user. Keep it local or on a feature branch until the user asks to commit, merge, push, or deploy.
