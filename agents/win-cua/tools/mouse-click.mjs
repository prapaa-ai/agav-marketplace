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
  name: "wincua_mouse_click",
  description: "Move the cursor to (x, y) and simulate a mouse button click. Supports left, right, and middle buttons, and double-click.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      x: { type: "number", description: "X coordinate (pixels from left edge of screen)" },
      y: { type: "number", description: "Y coordinate (pixels from top edge of screen)" },
      button: {
        type: "string",
        enum: ["left", "right", "middle"],
        description: "Mouse button to click (default: left)"
      },
      double_click: {
        type: "boolean",
        description: "Whether to double-click (default: false)"
      }
    },
    required: ["x", "y"]
  }
};

export async function execute({ x, y, button, double_click }) {
  const btn = button || "left";
  const flags = {
    left:   { down: 2,  up: 4  },
    right:  { down: 8,  up: 16 },
    middle: { down: 32, up: 64 }
  };
  const { down, up } = flags[btn] || flags.left;
  const ix = Math.round(x);
  const iy = Math.round(y);

  const clickOnce = `
[MouseInput]::mouse_event(${down}, 0, 0, 0, 0)
[MouseInput]::mouse_event(${up}, 0, 0, 0, 0)`;

  const clickCode = double_click
    ? `${clickOnce}
Start-Sleep -Milliseconds 50${clickOnce}`
    : clickOnce;

  const psCommand = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MouseInput {
    [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@
[MouseInput]::SetCursorPos(${ix}, ${iy})
Start-Sleep -Milliseconds 100
${clickCode}
Write-Output "OK"
`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };
  const label = double_click ? "Double-clicked" : "Clicked";
  return { output: `${label} at (${ix}, ${iy}) with ${btn} button`, isError: false };
}

export default { schema, execute };
