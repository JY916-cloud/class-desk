#!/usr/bin/env python3
"""Serve Class desk and keep backup.json on disk."""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKUP = ROOT / "backup.json"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/save":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400)
            return
        if not isinstance(data, dict) or not isinstance(data.get("students"), list) or not data["students"]:
            self.send_error(400)
            return
        BACKUP.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8877), Handler).serve_forever()
