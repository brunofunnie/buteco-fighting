"""Bind visual approval to the exact reference, recipe, geometry and exports."""
import hashlib
from pathlib import Path

def review_fingerprint(run: Path) -> str:
    files=[run/'base-source.png',run/'sprite-request.json',run/'runtime-metrics.json',*sorted((run/'curated').glob('*.png'))]
    digest=hashlib.sha256()
    for file in files:
        digest.update(str(file.relative_to(run)).encode())
        digest.update(b'\0')
        digest.update(hashlib.sha256(file.read_bytes()).digest())
    return digest.hexdigest()
