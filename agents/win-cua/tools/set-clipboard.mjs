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
  name: "wincua_set_clipboard",
  description: "Set the Windows clipboard to the given text. Useful for pasting content into applications.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to place on the clipboard"
      }
    },
    required: ["text"]
  }
};

export async function execute({ text }) {
  const psCommand = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText(${JSON.stringify(text)})`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };

  const preview = text.length > 50 ? text.slice(0, 50) + "..." : text;
  return { output: `Set clipboard to: ${preview}`, isError: false };
}

export default { schema, execute };
