import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const DEFAULT_HOST = process.env.HOST || "0.0.0.0";
const DEFAULT_PORT = Number.parseInt(`${process.env.PORT || "3000"}`, 10);
const PORT = Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 3000;
const AUTO_KILL = !["0", "false", "off", "no"].includes(`${process.env.DEV_SMART_KILL_PORT_OWNER || "1"}`.trim().toLowerCase());

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (value) => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {}
      resolve(value);
    };
    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function listListeningPidsWindows(port) {
  const result = spawnSync("netstat", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const normalized = line.trim().replace(/\s+/g, " ");
    if (!normalized) continue;
    if (!normalized.includes("LISTENING")) continue;
    const parts = normalized.split(" ");
    if (parts.length < 5) continue;
    const localAddress = parts[1] || "";
    const pid = parts[parts.length - 1] || "";
    if (!localAddress.endsWith(`:${port}`)) continue;
    if (!/^\d+$/.test(pid)) continue;
    pids.add(Number(pid));
  }
  return [...pids];
}

function killPidWindows(pid) {
  const result = spawnSync("taskkill", ["/PID", `${pid}`, "/T", "/F"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0;
}

async function freePortIfNeeded(port) {
  const busy = await isPortOpen(port);
  if (!busy) return;

  console.log(`[dev-smart] Porta ${port} ocupada.`);
  if (!AUTO_KILL) {
    throw new Error(`porta ${port} ocupada e DEV_SMART_KILL_PORT_OWNER=0`);
  }

  if (process.platform !== "win32") {
    throw new Error(`porta ${port} ocupada; auto-kill atualmente configurado apenas para Windows`);
  }

  const pids = listListeningPidsWindows(port);
  if (!pids.length) {
    throw new Error(`porta ${port} ocupada e nenhum PID de listener encontrado`);
  }

  console.log(`[dev-smart] Encerrando PID(s) na porta ${port}: ${pids.join(", ")}`);
  for (const pid of pids) {
    const ok = killPidWindows(pid);
    if (!ok) console.warn(`[dev-smart] Falha ao encerrar PID ${pid}.`);
  }

  for (let i = 0; i < 20; i += 1) {
    if (!(await isPortOpen(port))) return;
    await wait(300);
  }
  throw new Error(`porta ${port} permaneceu ocupada apos tentativa de limpeza`);
}

function startNextDev(host, port) {
  console.log(`[dev-smart] Iniciando Next.js em http://localhost:${port} (host ${host})`);
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(command, ["run", "dev:next", "--", "-H", host, "-p", `${port}`], {
    stdio: "inherit",
    env: process.env,
    windowsHide: false,
    shell: process.platform === "win32",
  });

  const forwardSignal = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));
  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
}

async function main() {
  await freePortIfNeeded(PORT);
  startNextDev(DEFAULT_HOST, PORT);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dev-smart] ${message}`);
  process.exit(1);
});
