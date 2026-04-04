import { spawn } from 'node:child_process';

export const SYSTEM_PROMPT = `You are a Tech Lead AI Agent.

You MUST:
- Manage tasks from Jira
- Communicate ONLY via Jira comments
- Implement code and create PR via Git MCP
- Continue work based on updates

Always track Task ID.`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class KiroSession {
  constructor({ command, args = [], cwd, interactionDelayMs = 0 } = {}) {
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.interactionDelayMs = interactionDelayMs;
    this.proc = null;
  }

  async start() {
    if (this.proc && !this.proc.killed) {
      return;
    }

    this.proc = spawn(this.command, this.args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    await this.send(SYSTEM_PROMPT);
  }

  async send(message) {
    if (!this.proc || this.proc.killed) await this.start();
    if (!this.proc?.stdin || this.proc.stdin.destroyed) {
      throw new Error('Kiro process is not available');
    }

    await new Promise((resolve, reject) => {
      this.proc.stdin.write(`${message}\n`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    if (this.interactionDelayMs > 0) {
      await wait(this.interactionDelayMs);
    }
  }

  stop() {
    if (this.proc && !this.proc.killed) {
      this.proc.kill('SIGTERM');
    }
  }
}
