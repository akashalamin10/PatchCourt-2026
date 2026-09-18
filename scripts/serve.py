#!/usr/bin/env python3
"""Local static server that mirrors Firebase cleanUrls.

    python3 scripts/serve.py
    # http://localhost:8080/pages/dashboard      -> public/pages/dashboard.html
    # http://localhost:8080/pages/dashboard.html -> same file
"""
from __future__ import annotations

import http.server
import os
import posixpath
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1] / "public"
PORT = int(os.environ.get("PORT", "8080"))

ALIASES = {
    "/dashboard": "/pages/dashboard.html",
    "/dashboard.html": "/pages/dashboard.html",
    "/board": "/pages/bounty-board.html",
    "/post": "/pages/post-bounty.html",
    "/setup": "/pages/setup.html",
    "/verify": "/pages/verify.html",
    "/case": "/pages/bounty-detail.html",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if path.endswith((".css", ".js")):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        elif path.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")):
            self.send_header("Cache-Control", "public, max-age=86400")
        elif path.endswith(".html") or path == "/":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        raw = unquote(parsed.path)
        raw = ALIASES.get(raw, raw)
        if raw.endswith("/"):
            raw = raw + "index.html"
        candidate = Path(super().translate_path(raw))
        if not candidate.is_file() and not Path(str(candidate) + ".html").exists():
            html = ROOT / posixpath.normpath(raw.lstrip("/")).removeprefix("/")
            html = Path(str(html) + ".html") if not str(html).endswith(".html") else html
            if html.is_file():
                return str(html)
        if not candidate.is_file():
            plus_html = Path(str(candidate) + ".html")
            if plus_html.is_file():
                return str(plus_html)
        return str(candidate)


if __name__ == "__main__":
    os.chdir(ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"PatchCourt local server: http://127.0.0.1:{PORT}")
    print("Clean URLs enabled (/pages/dashboard == /pages/dashboard.html)")
    server.serve_forever()
