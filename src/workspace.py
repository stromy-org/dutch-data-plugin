"""
Workspace output path resolution for ClaudeCowork build scripts.

Usage (from workspace/<client>/build/<deliverable>/build.py):
    import sys; sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'src'))
    from workspace import ensure_output_dir, resolve_output_path

    output_dir = ensure_output_dir(__file__)
    # → workspace/<client>/output/<deliverable>/
"""

from __future__ import annotations

import os
from pathlib import Path


def resolve_project_root(build_path: str | Path) -> Path:
    """Walk up from a build script to find the project root.

    Expects: workspace/<client>/build/<deliverable>/ → returns workspace/<client>/
    Falls back to the build script's own directory if structure doesn't match.
    """
    p = Path(build_path).resolve()
    build_dir = p if p.is_dir() else p.parent
    if build_dir.parent.name == "build":
        return build_dir.parent.parent  # up two levels
    return build_dir  # legacy flat structure


def resolve_output_dir(
    build_path: str | Path, *, output_dir: str | Path | None = None
) -> Path:
    """Resolve the output directory for a build script.

    Precedence:
        1. output_dir kwarg (explicit — for external agents)
        2. OUTPUT_DIR env var
        3. .remotion-project marker → <projectRoot>/out/
        4. Convention → <projectRoot>/output/<deliverable>/
    """
    if output_dir is not None:
        return Path(output_dir).resolve()
    env = os.environ.get("OUTPUT_DIR")
    if env:
        return Path(env).resolve()

    project_root = resolve_project_root(build_path)
    p = Path(build_path).resolve()
    build_dir = p if p.is_dir() else p.parent

    # Remotion exception
    if (project_root / ".remotion-project").exists():
        return project_root / "out"

    # New convention: workspace/<client>/output/<deliverable>/
    if build_dir.parent.name == "build":
        deliverable = build_dir.name
        return project_root / "output" / deliverable

    # Legacy flat: workspace/<project>/output/
    return project_root / "output"


def ensure_output_dir(
    build_path: str | Path, *, output_dir: str | Path | None = None
) -> Path:
    """Resolve output dir and create it if it doesn't exist."""
    d = resolve_output_dir(build_path, output_dir=output_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


def resolve_output_path(
    build_path: str | Path, filename: str, *, output_dir: str | Path | None = None
) -> Path:
    """Resolve full path to an output file."""
    return resolve_output_dir(build_path, output_dir=output_dir) / filename
