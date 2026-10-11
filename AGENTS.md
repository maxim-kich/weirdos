# Working on weirdos

Before adding or modifying an element, read [WEIRDO_GUIDE.md](WEIRDO_GUIDE.md).

When asked to add a supplied folder, finish the integration: import its HTML and assets, create its static preview, add its registry entry, implement pose transitions when necessary, optimize oversized assets, generate its ZIP, and verify the result. Do not just add a gallery tile.

- Keep each element self-contained under `elements/<folder>/`.
- Use the user's exact element name as the title. Do not add placeholders or explanatory gallery copy.
- Keep the existing gallery, ASCII logo, two-column layout, downloads, modal positioning, and transition timings unless the user requests a change.
- Preserve the element's own design and interaction. Gallery styles must not leak into it.
- Keep the preview canvas fixed during motion and scale it uniformly. Never resize the iframe or stretch its axes to animate it.
- Run `npm run check` and `npm run package`, then perform the browser and extracted-ZIP checks in the guide before considering the integration ready for `main`.
- Report any verification that could not be completed. Syntax checks alone do not prove the interaction or transition works.
- Keep integration work local or on a feature branch. Commit, merge, push, or deploy only when the user requests it. Do not treat “add this folder” as publication authorization.
- Preserve existing local work; stage only the files belonging to the requested change.
