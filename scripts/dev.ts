#!/usr/bin/env bun
/**
 * Cross-platform `bun run dev` orchestrator.
 *
 * Spawns the API and web dev processes side by side, prefixes their output,
 * and forwards SIGINT / SIGTERM / SIGBREAK so a single Ctrl+C cleanly tears
 * down the whole tree (including the Next.js + Bun child processes that
 * Bun's built-in `--parallel` does not always kill on Windows).
 */
import { spawn, spawnSync, type Subprocess } from "bun";

const IS_WIN = process.platform === "win32";

interface Child {
  name: string;
  color: string;
  cmd: string[];
  proc?: Subprocess;
  exited?: boolean;
}

const children: Child[] = [
  {
    name: "api",
    color: "\x1b[36m",
    cmd: IS_WIN
      ? ["bun.exe", "--cwd", "apps/api", "--env-file=../../.env", "--hot", "src/index.ts"]
      : ["bun", "--cwd", "apps/api", "--env-file=../../.env", "--hot", "src/index.ts"],
  },
  {
    name: "web",
    color: "\x1b[35m",
    cmd: IS_WIN
      ? ["bun.exe", "--cwd", "apps/web", "dev"]
      : ["bun", "--cwd", "apps/web", "dev"],
  },
];

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

function prefixed(name: string, color: string, line: string): string {
  return `${color}${name.padEnd(3)}${RESET} ${DIM}|${RESET} ${line}`;
}

async function pipeOutput(c: Child, stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      process.stdout.write(`${prefixed(c.name, c.color, line)}\n`);
      nl = buffer.indexOf("\n");
    }
  }
  if (buffer.length > 0) {
    process.stdout.write(`${prefixed(c.name, c.color, buffer)}\n`);
  }
}

function killChild(c: Child): void {
  if (!c.proc || c.exited) return;
  const pid = c.proc.pid;
  if (!pid) return;
  if (IS_WIN) {
    // Bun's child Bun process spawns its own Bun + Node tree on Windows. Only
    // `taskkill /T /F` reliably reaps it; SIGTERM via Bun's kill() leaves
    // grandchildren orphaned (next dev, drizzle-kit, etc.).
    spawnSync({
      cmd: ["taskkill", "/PID", String(pid), "/T", "/F"],
      stdout: "ignore",
      stderr: "ignore",
    });
  } else {
    try {
      c.proc.kill("SIGTERM");
    } catch {
      // already dead
    }
    setTimeout(() => {
      try {
        c.proc?.kill("SIGKILL");
      } catch {
        // already dead
      }
    }, 4_000).unref();
  }
}

let shuttingDown = false;

async function shutdown(reason: string, code = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(`${DIM}dev | shutting down (${reason})${RESET}\n`);

  for (const c of children) killChild(c);

  const grace = setTimeout(() => {
    process.stdout.write(`${DIM}dev | grace timeout, exiting${RESET}\n`);
    process.exit(code || 1);
  }, 6_000);
  grace.unref();

  await Promise.allSettled(
    children.map(async (c) => {
      if (!c.proc) return;
      try {
        await c.proc.exited;
      } catch {
        // ignore
      }
    }),
  );

  clearTimeout(grace);
  process.stdout.write(`${DIM}dev | stopped${RESET}\n`);
  process.exit(code);
}

function startChild(c: Child): void {
  c.proc = spawn({
    cmd: c.cmd,
    cwd: process.cwd(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  void pipeOutput(c, c.proc.stdout as unknown as ReadableStream<Uint8Array>);
  void pipeOutput(c, c.proc.stderr as unknown as ReadableStream<Uint8Array>);
  void c.proc.exited.then((code) => {
    c.exited = true;
    process.stdout.write(
      `${DIM}dev | [${c.name}] exited with code ${code}${RESET}\n`,
    );
    if (!shuttingDown) {
      void shutdown(`${c.name} exited`, code ?? 1);
    }
  });
}

for (const c of children) startChild(c);

for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"] as const) {
  process.on(sig, () => void shutdown(sig));
}

// Windows console events: when the user hits Ctrl+C in cmd/powershell, Node's
// stdin gets an EOF. Watch for it as a backup signal channel.
if (IS_WIN) {
  process.stdin.on("end", () => void shutdown("stdin-end"));
}
