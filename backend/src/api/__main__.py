"""Entry point: run the api ASGI app.

uv run api
"""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
    host = os.environ.get("SHELL_HOST", "127.0.0.1")
    port = int(os.environ.get("SHELL_PORT", "8090"))
    uvicorn.run("api.app:app", host=host, port=port, factory=False)


if __name__ == "__main__":
    main()
