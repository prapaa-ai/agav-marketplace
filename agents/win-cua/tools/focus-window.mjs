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
  name: "wincua_focus_window",
  description: "Bring a window to the foreground by process ID or window title substring. Use list-windows first to find the correct PID or title.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      pid: {
        type: "number",
        description: "Process ID of the window to focus"
      },
      title: {
        type: "string",
        description: "Substring of the window title to focus (matches the first window found)"
      }
    },
    required: []
  }
};

export async function execute({ pid, title } = {}) {
  if (!pid && !title) {
    return { output: "Either pid or title must be provided", isError: true };
  }

  const findProc = pid
    ? `$proc = Get-Process -Id ${Math.round(pid)} -ErrorAction SilentlyContinue`
    : `$proc = Get-Process | Where-Object { $_.MainWindowTitle -like ${JSON.stringify(`*${title}*`)} } | Select-Object -First 1`;

  const noWindowMsg = title
    ? `No window found matching "${title}"`
    : `No window found with PID ${pid}`;

  const psCommand = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WindowHelper {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
${findProc}
if ($proc -and $proc.MainWindowHandle -ne 0) {
    [WindowHelper]::ShowWindow($proc.MainWindowHandle, 9)
    [WindowHelper]::SetForegroundWindow($proc.MainWindowHandle)
    Write-Output "Focused window: $($proc.MainWindowTitle)"
} else {
    Write-Output "NO_WINDOW_FOUND"
}
`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };
  if (stdout === "NO_WINDOW_FOUND") return { output: noWindowMsg, isError: true };
  return { output: stdout, isError: false };
}

export default { schema, execute };
