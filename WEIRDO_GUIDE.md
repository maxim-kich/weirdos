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

Match the interactive document's background, element size, alignment, and relative position. The preview and interactive element should occupy the same coordinates in the same viewport; opening the modal must not move the element inside its canvas.

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
  download: './downloads/myWeirdo.zip',
}
```

The ID must be unique and contain only letters, numbers, hyphens, or underscores. The ZIP filename and its top-level folder use that ID. The title stays one line and truncates automatically. Adding an ordinary entry should not require editing `app.js`, `styles.css`, or the gallery HTML.

## 4. Preserve positioning and motion

The host moves the actual static preview into the modal's top layer. Its logical iframe width and height stay at the gallery shot size. A single uniform scale and translation carries that fixed canvas into the centered modal and back. This preserves the element's proportions and relative position. Never animate separate X/Y scales, iframe dimensions, or viewport-dependent reflow during the transition.

The host controls these established behaviors:

| Behavior | Contract |
| --- | --- |
| Gallery | Two cards per row; one on mobile; unified card hover |
| Download | ZIP download in the modal toolbar only; gallery cards show only the preview and title |
| Canvas | 4:3, centered in the modal, with outer space |
| Opening | 240 ms, `cubic-bezier(.22, 1, .36, 1)` |
| Closing | 420 ms with the same easing |
| Toolbar | Separate from the canvas; appears after opening and hides immediately when closing starts |
| Background | Blurred and dimmed |
| Dismissal | Close button, Escape, or a click outside the preview and toolbar |
| Scroll | Locked from opening through closing; original page position restored afterward |
| Reduced motion | Host motion becomes instantaneous; element must also respect the preference |
| Isolation | Static thumbnail has no script permission; modal allows scripts without same-origin access |

For elements whose preview and idle states look the same, the host's default handoff is sufficient. If they differ visibly, use the pose bridge below instead of letting a crossfade substitute for motion.

## 5. Animate between different poses when needed

Add `transitionPose: true` to that registry entry **only after implementing this protocol** in its interactive HTML. The host opens the document with `?pose=preview`.

1. Read that query parameter and initialize the interactive document in exactly the static preview pose, without an entrance animation.
2. After that pose and required assets are ready, notify the host:

   ```js
   if (parent !== window) parent.postMessage({ type: 'weirdos:ready' }, '*');
   ```

3. Listen for messages from `parent`, verify `event.source === parent`, and handle `{ type: 'weirdos:pose', pose: 'idle' }` and `{ type: 'weirdos:pose', pose: 'preview' }`.
4. Animate actual element parts between poses, starting from their current rendered values. Do not fade between two different silhouettes. Opening's idle motion should be about **200 ms**; returning to preview should finish within **350 ms**, before the host's 420 ms closing motion ends.
5. Cancel or retarget ongoing animations safely when direction changes. Disable activation while settling, then restore it in idle. Closing during an interaction must end in the same pose as `preview.html`, including transient marks and effects.
6. Keep normal standalone behavior when `?pose=preview` is absent. Respect `prefers-reduced-motion`.

The host validates messages against the active iframe's `contentWindow`. `'*'` is needed because the sandboxed document has an opaque origin; do not add `allow-same-origin` to work around this.

Forward Escape from the interactive element:

```js
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && parent !== window) {
    parent.postMessage({ type: 'weirdos:close' }, '*');
  }
});
```

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
- At desktop and mobile widths, the element stays in the same relative position while opening and closing. There is no distortion, reflow, flash, or abrupt pose swap.
- The modal interaction works repeatedly. Also close during opening, settling, and the element's own animation.
- The toolbar hides at the start of closing. Escape closes from inside the iframe; clicking outside the canvas and toolbar also closes it. Clicking the canvas or its controls must not dismiss it. Keyboard focus returns; there is no persistent card selection.
- Page scrolling stays locked during the modal and both transitions. Closing restores the original scroll position. Check reduced motion and viewport resizing.
- The modal's download button retrieves the correct ZIP. Gallery cards have no download icon. Inspect the archive, extract it into a temporary folder, and open its `index.html` directly to test the interaction and asset paths.
- There are no new console errors, missing assets, unrelated changes, or committed generated ZIPs.

Summarize the integration and checks for the user. Keep it local or on a feature branch until the user asks to commit, merge, push, or deploy.
