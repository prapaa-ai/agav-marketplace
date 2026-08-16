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
  name: "wincua_open_app",
  description: "Launch an application or open a file. Supports executable names (notepad, calc), full paths, URLs (opens in default browser), and document paths.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      app: {
        type: "string",
        description: "Application name, executable path, file path, or URL to open"
      },
      args: {
        type: "string",
        description: "Optional command-line arguments to pass to the application"
      },
      wait: {
        type: "boolean",
        description: "Whether to wait for the application to exit before returning (default: false)"
      }
    },
    required: ["app"]
  }
};

export async function execute({ app, args, wait }) {
  let psCommand = `Start-Process -FilePath ${JSON.stringify(app)}`;
  if (args) psCommand += ` -ArgumentList ${JSON.stringify(args)}`;
  if (wait) psCommand += ` -Wait`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };
  return { output: `Launched: ${app}`, isError: false };
}

export default { schema, execute };
