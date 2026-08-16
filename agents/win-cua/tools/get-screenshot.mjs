import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  name: "wincua_get_screenshot",
  description: "Capture a screenshot of the primary screen and save it to a PNG file. Returns the saved file path.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      output_path: {
        type: "string",
        description: "Optional file path to save the screenshot (PNG). Defaults to a temp file."
      }
    },
    required: []
  }
};

export async function execute({ output_path } = {}) {
  const path = output_path || join(tmpdir(), `agav-screenshot-${Date.now()}.png`);

  const psCommand = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$g.Dispose()
$path = ${JSON.stringify(path)}
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output $path
`;

  const { stdout, error } = await runPS(psCommand);
  if (error && !stdout) return { output: error, isError: true };
  return { output: `Screenshot saved to: ${stdout || path}`, isError: false };
}

export default { schema, execute };
