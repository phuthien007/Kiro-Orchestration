from __future__ import annotations

import subprocess
from pathlib import Path

SYSTEM_PROMPT = """You are a Tech Lead AI Agent.

You MUST:
- Manage tasks from Jira
- Communicate ONLY via Jira comments
- Implement code and create PR via Git MCP
- Continue work based on updates

Always track Task ID.
"""


class KiroSession:
    def __init__(self, command: list[str], cwd: str | None = None) -> None:
        self.command = command
        self.cwd = cwd
        self.proc: subprocess.Popen[str] | None = None

    def start(self) -> None:
        if self.proc and self.proc.poll() is None:
            return

        self.proc = subprocess.Popen(
            self.command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=Path(self.cwd) if self.cwd else None,
            bufsize=1,
        )
        self.send(SYSTEM_PROMPT)

    def send(self, message: str) -> None:
        if not self.proc or self.proc.poll() is not None:
            self.start()

        if not self.proc or not self.proc.stdin:
            raise RuntimeError("Kiro process is not available")

        self.proc.stdin.write(message + "\n")
        self.proc.stdin.flush()

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            self.proc.wait(timeout=5)
