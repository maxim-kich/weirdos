# weirdos

A minimal gallery for UI experiments. Run `npm run dev` and open http://localhost:8943.

The gallery currently contains `isSwtchCatDisabled` only. To add another element, drop its folder into the project and ask an agent to integrate it. [AGENTS.md](AGENTS.md) directs agents to the complete [integration guide](WEIRDO_GUIDE.md), including previews, positioning, transitions, ZIPs, and checks before `main`.

Keep each element and its assets together under `elements/`. `npm run package` creates standalone ZIPs in `downloads/`; `npm run dev` packages them automatically before starting the server. Each ZIP includes the element's HTML and assets and works by opening its `index.html` locally.

Set `previewSrc` to a separate static HTML thumbnail when the gallery should show a specific pose. The modal uses `src`; gallery-only preview files are excluded from downloads.

Shots use a 4:3 aspect ratio. Previews run in sandboxed iframes so each snippet owns its styles. Thumbnail scripts are disabled; the fullscreen preview enables scripts. Use inline assets or absolute URLs inside snippets. A snippet can request Escape dismissal by posting `{ type: 'weirdos:close' }` to its parent.

`npm run check` validates JavaScript syntax, registry entries, static previews, and local asset paths. Node.js and Python 3 are required; no third-party dependencies are needed.
