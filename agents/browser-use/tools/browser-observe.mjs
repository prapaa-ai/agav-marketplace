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
  name: "browser_observe",
  description: "Extract text content from a webpage. Optionally target a specific element with a CSS selector. Returns up to 5000 characters of visible text.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to extract content from (include https://)"
      },
      selector: {
        type: "string",
        description: "Optional CSS selector to extract text from a specific element (returns all matching elements' text)"
      }
    },
    required: ["url"]
  }
};

export async function execute({ url, selector }) {
  const browserType = process.env.PLAYWRIGHT_BROWSER || "chromium";

  const extractCode = selector
    ? `
    const texts = await page.locator(${JSON.stringify(selector)}).allTextContents();
    const content = texts.join("\\n");
    `
    : `
    const content = await page.evaluate(() => document.body.innerText);
    `;

  const playwrightScript = `
const { ${browserType} } = require("playwright");
(async () => {
  const browser = await ${browserType}.launch();
  const page = await browser.newPage();
  try {
    await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle", timeout: 30000 });
    ${extractCode}
    const truncated = content.length > 5000 ? content.slice(0, 5000) + "\\n[truncated]" : content;
    console.log(JSON.stringify({ content: truncated, success: true }));
  } finally {
    await browser.close();
  }
})().catch(e => console.log(JSON.stringify({ error: e.message, success: false })));
`;

  const { stdout, error } = await runPlaywright(playwrightScript);
  if (error) return { output: error, isError: true };

  try {
    const result = JSON.parse(stdout);
    if (!result.success) return { output: result.error || "Observation failed", isError: true };
    return { output: result.content, isError: false };
  } catch {
    return { output: stdout || "No output from browser", isError: true };
  }
}

export default { schema, execute };
