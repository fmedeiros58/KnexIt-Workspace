const { spawn } = require("node:child_process");
const { resolve } = require("node:path");
const net = require("node:net");

const nextBin = process.platform === "win32" ? "next.cmd" : "next";
const host = process.env.KNEXCHAT_HOST || "localhost";
const port = process.env.KNEXCHAT_PORT || process.env.PORT || "3850";

function isPortInUse(portToCheck, hostToCheck) {
  return new Promise((resolvePort) => {
    const tester = net.createServer();

    tester.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolvePort(true);
        return;
      }
      resolvePort(true);
    });

    tester.once("listening", () => {
      tester.close(() => resolvePort(false));
    });

    tester.listen(Number(portToCheck), hostToCheck);
  });
}

async function run() {
  const hostCandidates = host === "localhost" ? ["localhost", "127.0.0.1", "::1"] : [host];
  const checks = await Promise.all(hostCandidates.map((candidate) => isPortInUse(port, candidate)));
  const portBusy = checks.some(Boolean);
  if (portBusy) {
    console.error(
      `[dev:knexchat] port ${port} is already in use on ${host}. ` +
        "Stop the process using it or set KNEXCHAT_PORT to another value.",
    );
    process.exit(1);
  }

  const env = {
    ...process.env,
    NEXT_DIST_DIR: ".next-knexchat",
    KNEXCHAT_STANDALONE: "1",
  };

  const child = spawn(nextBin, ["dev", "-H", host, "-p", String(port)], {
    stdio: "inherit",
    shell: true,
    env,
    cwd: resolve(__dirname, ".."),
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

run().catch((error) => {
  console.error("[dev:knexchat] failed to initialize", error);
  process.exit(1);
});
