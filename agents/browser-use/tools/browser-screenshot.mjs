import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

async function runPlaywright(script) {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["-e", script],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    );
    return { stdout: stdout.trim(), error: null };
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message || String(err);
    if (msg.includes("Cannot find module") && msg.includes("playwright")) {
      return { stdout: "", error: "Playwright not installed. Run: npm install -g playwright && npx playwright install chromium" };
    }
    return { stdout: "", error: msg.slice(0, 500) };
  }
}

export const schema = {
  name: "browser_screenshot",
  description: "Take a screenshot of a webpage and save it to a file. Returns the saved file path.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to screenshot (include https://)"
      },
      selector: {
        type: "string",
        description: "Optional CSS selector to screenshot a specific element only"
      },
      full_page: {
        type: "boolean",
        description: "Whether to take a full-page screenshot (default: false)"
      }
    },
    required: ["url"]
  }
};

export async function execute({ url, selector, full_page }) {
  const browserType = process.env.PLAYWRIGHT_BROWSER || "chromium";
  const screenshotPath = join(tmpdir(), `agav-screenshot-${Date.now()}.png`);

  const screenshotCode = selector
    ? `await page.locator(${JSON.stringify(selector)}).screenshot({ path: ${JSON.stringify(screenshotPath)} });`
    : `await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, fullPage: ${full_page ? true : false} });`;

  const playwrightScript = `
const { ${browserType} } = require("playwright");
(async () => {
  const browser = await ${browserType}.launch();
  const page = await browser.newPage();
  try {
    await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle", timeout: 30000 });
    ${screenshotCode}
    console.log(JSON.stringify({ path: ${JSON.stringify(screenshotPath)}, success: true }));
  } finally {
    await browser.close();
  }
})().catch(e => console.log(JSON.stringify({ error: e.message, success: false })));
`;

  const { stdout, error } = await runPlaywright(playwrightScript);
  if (error) return { output: error, isError: true };

  try {
    const result = JSON.parse(stdout);
    if (!result.success) return { output: result.error || "Screenshot failed", isError: true };
    return { output: `Screenshot saved to: ${result.path}`, isError: false };
  } catch {
    return { output: stdout || "No output from browser", isError: true };
  }
}

export default { schema, execute };
