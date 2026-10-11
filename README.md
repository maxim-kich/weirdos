# weirdos

A minimal gallery for UI experiments. Run `npm run dev` and open http://localhost:8943.

The gallery contains `isSwtchCatDisabled` and `swipeActionMmmmm`. To add another element, drop its folder into the project and ask an agent to integrate it. [AGENTS.md](AGENTS.md) directs agents to the complete [integration guide](WEIRDO_GUIDE.md), including previews, positioning, transitions, ZIPs, and checks before `main`.

Keep each element and its assets together under `elements/`. `npm run package` creates standalone ZIPs in `downloads/`; `npm run dev` packages them automatically before starting the server. Each ZIP includes the element's HTML and assets and works by opening its `index.html` locally.

Set `previewSrc` to a separate static HTML thumbnail when the gallery should show a specific pose. The modal uses `src`; gallery-only preview files are excluded from downloads.

Shots use a 4:3 aspect ratio. Previews run in sandboxed iframes so each snippet owns its styles. Thumbnail scripts are disabled; the fullscreen preview independently loads the interactive snippet and waits for its readiness message. Keep assets local to each snippet. A snippet can request Escape dismissal by posting `{ type: 'weirdos:close' }` to its parent.

Each preview has a shareable URL (`?preview=<id>`); the toolbar copies that link or downloads its ZIP. The gallery and Impressum use Simple Analytics. The footer links to the German legal notice and privacy information in `impressum.html`.

`npm run check` validates JavaScript syntax, registry entries, static previews, and local asset paths. Node.js and Python 3 are required; no third-party dependencies are needed.

For Cloudflare Git integration, set the build command to `npm run build` and the build output directory (or Workers assets directory) to `dist`. Keep the project root as this repository's root. The build validates and packages the snippets, then includes all gallery pages and browser resources, including `impressum.html` and `legal.css`. It fails if an HTML page references a missing local file. Deploy the complete `dist/` directory; deploying only the gallery files leaves the Impressum link broken.
