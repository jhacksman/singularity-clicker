"""Create an allowlisted public-source archive, excluding private hosting metadata and Git history."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
out = root / 'exports' / 'singularity-clicker-source.zip'
out.parent.mkdir(exist_ok=True)
items = ['README.md', 'package.json', 'build.mjs', '.gitignore', 'src', 'assets', 'tests', 'scripts', 'docs', 'dist']
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for item in items:
        p = root / item
        for f in sorted(p.rglob('*')) if p.is_dir() else [p]:
            if f.is_file() and '__pycache__' not in f.parts:
                archive.write(f, Path('singularity-clicker') / f.relative_to(root))
print(out)
