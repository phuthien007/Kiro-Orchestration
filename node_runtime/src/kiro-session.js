import { spawn } from 'node:child_process';

export const SYSTEM_PROMPT = `You are a Tech Lead AI Agent.

You MUST:
- Manage tasks from Jira
- Communicate ONLY via Jira comments
- Implement code and create PR via Git MCP
- Continue work based on updates

Always track Task ID.`;

export class KiroSession {
  constructor({ command, args = [], cwd } = {}) {
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.proc = null;
  }

  start() {
    if (this.proc && !this.proc.killed) {
      return;
    }

    this.proc = spawn(this.command, this.args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.send(SYSTEM_PROMPT);
  }

  send(message) {
    if (!this.proc || this.proc.killed) this.start();
    if (!this.proc?.stdin || this.proc.stdin.destroyed) {
      throw new Error('Kiro process is not available');
    }
    this.proc.stdin.write(`${message}\n`);
  }

  stop() {
    if (this.proc && !this.proc.killed) {
      this.proc.kill('SIGTERM');
    }
  }
}
