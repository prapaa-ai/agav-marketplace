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

/**
 * Escape special SendKeys characters.
 * The chars +, ^, %, ~, (, ), [, ], {, } have special meaning in SendKeys
 * and must be wrapped in braces to send literally.
 */
function escapeForSendKeys(text) {
  return text.replace(/[+^%~(){}\[\]]/g, c => {
    if (c === "{") return "{{}";
    if (c === "}") return "{}}";
    return `{${c}}`;
  });
}

export const schema = {
  name: "wincua_type_text",
  description: "Type text into the currently focused window using SendKeys. Special SendKeys characters (+, ^, %, ~, (, ), [, ], {, }) are automatically escaped so they type literally.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to type into the active window"
      },
      delay_ms: {
        type: "number",
        description: "Delay in milliseconds between keystrokes (default: 0; note: SendKeys sends atomically, this adds a pre-send pause)"
      }
    },
    required: ["text"]
  }
};

export async function execute({ text, delay_ms }) {
  const escaped = escapeForSendKeys(text);
  const delay = Math.max(0, Math.round(delay_ms || 0));

  const psCommand = delay > 0
    ? `Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds ${delay}; [System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(escaped)})`
    : `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(escaped)})`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };
  return { output: `Typed ${text.length} character(s)`, isError: false };
}

export default { schema, execute };
