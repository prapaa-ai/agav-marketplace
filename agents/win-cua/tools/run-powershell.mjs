import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function isWindows() { return process.platform === "win32"; }

async function runPS(command) {
  if (!isWindows()) return { stdout: "", error: "win-cua only works on Windows (win32 platform)" };
  try {
    const { stdout, stderr } = await execFileAsync(
      "powershell",
      ["-NonInteractive", "-NoProfile", "-Command", command],
      { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }
    );
    return { stdout: stdout.trim(), error: stderr ? stderr.trim() : null };
  } catch (err) {
    return { stdout: "", error: err.stderr?.trim() || err.message };
  }
}

export const schema = {
  name: "wincua_run_powershell",
  description: "Execute an arbitrary PowerShell command or script and return its output. Use with caution — this runs commands directly on the host system. Output is truncated to 3000 characters.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "PowerShell command or script block to execute"
      }
    },
    required: ["command"]
  }
};

export async function execute({ command }) {
  const { stdout, error } = await runPS(command);
  if (error && !stdout) return { output: error, isError: true };

  const truncated = stdout.length > 3000
    ? stdout.slice(0, 3000) + "\n[truncated]"
    : stdout;

  return { output: truncated || "(no output)", isError: false };
}

export default { schema, execute };
