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
  name: "wincua_get_screen_size",
  description: "Get the primary screen dimensions and working area size.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
};

export async function execute(_params = {}) {
  const psCommand = `
Add-Type -AssemblyName System.Windows.Forms
$s = [System.Windows.Forms.Screen]::PrimaryScreen
$b = $s.Bounds
$w = $s.WorkingArea
Write-Output "$($b.Width)x$($b.Height) working:$($w.Width)x$($w.Height)"
`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };

  const match = stdout.match(/^(\d+)x(\d+) working:(\d+)x(\d+)/);
  if (match) {
    return {
      output: `Primary screen: ${match[1]}x${match[2]} (working area: ${match[3]}x${match[4]})`,
      isError: false
    };
  }
  return { output: stdout, isError: false };
}

export default { schema, execute };
