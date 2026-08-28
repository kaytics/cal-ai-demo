"""Entry point: regenerate the top-level `shared/` boundary.

uv run export-schema
"""

from __future__ import annotations

from pathlib import Path

from utils.codegen.writer import write_outputs

# repo-root/shared/  (this file: backend/src/utils/codegen/__main__.py)
_SHARED = Path(__file__).resolve().parents[4] / "shared"


def main() -> None:
    for path in write_outputs(_SHARED):
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
