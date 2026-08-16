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
  name: "wincua_list_windows",
  description: "List all visible windows (processes with a main window title). Optionally filter by title substring.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description: "Optional substring to filter window titles (case-insensitive)"
      }
    },
    required: []
  }
};

export async function execute({ filter } = {}) {
  const psCommand = filter
    ? `Get-Process | Where-Object { $_.MainWindowTitle -ne "" -and $_.MainWindowTitle -like ${JSON.stringify(`*${filter}*`)} } | Select-Object Id, ProcessName, MainWindowTitle | Format-Table -AutoSize | Out-String`
    : `Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object Id, ProcessName, MainWindowTitle | Format-Table -AutoSize | Out-String`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };
  return { output: stdout || "No windows found", isError: false };
}

export default { schema, execute };
