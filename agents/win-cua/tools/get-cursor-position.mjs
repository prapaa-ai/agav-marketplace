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
  name: "wincua_get_cursor_position",
  description: "Get the current mouse cursor position on screen.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};

export async function execute(_params = {}) {
  const psCommand = `Add-Type -AssemblyName System.Windows.Forms; $p = [System.Windows.Forms.Cursor]::Position; Write-Output "$($p.X),$($p.Y)"`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };

  const match = stdout.match(/^(-?\d+),(-?\d+)/);
  if (match) {
    return { output: `Cursor position: X=${match[1]}, Y=${match[2]}`, isError: false };
  }
  return { output: stdout, isError: false };
}

export default { schema, execute };
