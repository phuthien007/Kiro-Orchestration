from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .event_listener import EventListener
from .event_router import EventRouter
from .kiro_session import KiroSession
from .session_manager import SessionManager


def build_manager() -> SessionManager:
    router = EventRouter()

    def session_factory() -> KiroSession:
        # Replace command with real Kiro CLI invocation in production.
        return KiroSession(command=["cat"])

    return SessionManager(session_factory=session_factory, router=router)


class WebhookHandler(BaseHTTPRequestHandler):
    listener = EventListener()
    manager = build_manager()

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {"/webhook/jira", "/webhook/gitbucket"}:
            self.send_response(404)
            self.end_headers()
            return

        source = "jira" if self.path.endswith("jira") else "gitbucket"
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))

        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
            event = self.listener.normalize(source, payload)
            message_type = self.manager.handle_event(event)
            response = {"ok": True, "message_type": message_type.value, "task_id": event.task_id}
            status = 200
        except Exception as exc:  # pragma: no cover
            response = {"ok": False, "error": str(exc)}
            status = 400

        encoded = json.dumps(response).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def run(host: str = "0.0.0.0", port: int = 8080) -> None:
    server = ThreadingHTTPServer((host, port), WebhookHandler)
    print(f"Listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
