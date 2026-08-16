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
  name: "wincua_mouse_move",
  description: "Move the mouse cursor to a specific screen coordinate without clicking.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      x: { type: "number", description: "X coordinate (pixels from left edge of screen)" },
      y: { type: "number", description: "Y coordinate (pixels from top edge of screen)" }
    },
    required: ["x", "y"]
  }
};

export async function execute({ x, y }) {
  const ix = Math.round(x);
  const iy = Math.round(y);

  const psCommand = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MouseMover {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@
[MouseMover]::SetCursorPos(${ix}, ${iy})
Write-Output "OK"
`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };
  return { output: `Moved cursor to (${ix}, ${iy})`, isError: false };
}

export default { schema, execute };
