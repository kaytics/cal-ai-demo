"""Entry point: run the shell ASGI app.

uv run shell
"""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
    host = os.environ.get("SHELL_HOST", "127.0.0.1")
    port = int(os.environ.get("SHELL_PORT", "8080"))
    uvicorn.run("shell.app:app", host=host, port=port, factory=False)


if __name__ == "__main__":
    main()
