"""Build standalone ZIP downloads from the snippet registry."""
import json
import subprocess
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
subprocess.run(["node", "scripts/validate-snippets.mjs"], cwd=root, check=True)
result = subprocess.run(
    ["node", "--input-type=module", "-e",
     "import { snippets } from './snippets.js'; console.log(JSON.stringify(snippets));"],
    cwd=root, check=True, capture_output=True, text=True,
)
snippets = json.loads(result.stdout)
for snippet in snippets:
    target = root / snippet["download"]
    target.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(target, "w", ZIP_DEFLATED) as archive:
        if "src" in snippet:
            source = (root / snippet["src"]).parent
            preview = (root / snippet["previewSrc"]).resolve() if snippet.get("previewSrc") else None
            for asset in sorted(source.rglob("*")):
                if asset.is_file() and asset.resolve() != preview and not any(part.startswith(".") for part in asset.relative_to(source).parts):
                    archive.write(asset, f'{snippet["id"]}/{asset.relative_to(source)}')
        else:
            archive.writestr(f'{snippet["id"]}/index.html', snippet["code"])
print(f'Packaged {len(snippets)} snippets.')
