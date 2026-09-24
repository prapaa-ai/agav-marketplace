import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  name: "browser_click",
  description: "Navigate to a URL, click on an element identified by a CSS selector, and return the resulting page state.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to navigate to (include https://)"
      },
      selector: {
        type: "string",
        description: "CSS selector of the element to click"
      },
      wait_for_navigation: {
        type: "boolean",
        description: "Whether to wait for page navigation after clicking (default: false)"
      }
    },
    required: ["url", "selector"]
  }
};

export async function execute({ url, selector, wait_for_navigation }) {
  const browserType = process.env.PLAYWRIGHT_BROWSER || "chromium";

  const clickCode = wait_for_navigation
    ? `
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
      page.click(${JSON.stringify(selector)})
    ]);
    `
    : `await page.click(${JSON.stringify(selector)});`;

  const playwrightScript = `
const { ${browserType} } = require("playwright");
(async () => {
  const browser = await ${browserType}.launch();
  const page = await browser.newPage();
  try {
    await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle", timeout: 30000 });
    ${clickCode}
    const title = await page.title();
    const currentUrl = page.url();
    console.log(JSON.stringify({ title, url: currentUrl, success: true }));
  } finally {
    await browser.close();
  }
})().catch(e => console.log(JSON.stringify({ error: e.message, success: false })));
`;

  const { stdout, error } = await runPlaywright(playwrightScript);
  if (error) return { output: error, isError: true };

  try {
    const result = JSON.parse(stdout);
    if (!result.success) return { output: result.error || "Click failed", isError: true };
    return { output: `Clicked '${selector}'. New page: ${result.title} — ${result.url}`, isError: false };
  } catch {
    return { output: stdout || "No output from browser", isError: true };
  }
}

export default { schema, execute };
