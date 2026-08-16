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
  name: "wincua_press_key",
  description: "Send a keystroke or key combination to the active window using SendKeys format. Examples: '{ENTER}', '{TAB}', '{ESC}', '^c' (Ctrl+C), '^v' (Ctrl+V), '%{F4}' (Alt+F4), '+{TAB}' (Shift+Tab), '{F5}', '{DELETE}', '{HOME}', '{END}'.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "Key or key combination in SendKeys format. Use ^ for Ctrl, % for Alt, + for Shift. Wrap special key names in braces: {ENTER}, {TAB}, {ESC}, {F1}-{F12}, {DELETE}, {HOME}, {END}, {PGUP}, {PGDN}, {UP}, {DOWN}, {LEFT}, {RIGHT}."
      }
    },
    required: ["key"]
  }
};

export async function execute({ key }) {
  const psCommand = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(key)})`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };
  return { output: `Sent key: ${key}`, isError: false };
}

export default { schema, execute };
