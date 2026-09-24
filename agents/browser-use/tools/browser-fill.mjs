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
  name: "browser_fill",
  description: "Navigate to a URL, fill in form fields, optionally submit the form, and return the resulting page state.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to navigate to (include https://)"
      },
      fields: {
        type: "array",
        description: "List of form fields to fill",
        items: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector for the input field" },
            value: { type: "string", description: "Value to fill into the field" }
          },
          required: ["selector", "value"]
        }
      },
      submit_selector: {
        type: "string",
        description: "Optional CSS selector for the submit button to click after filling fields"
      }
    },
    required: ["url", "fields"]
  }
};

export async function execute({ url, fields, submit_selector }) {
  const browserType = process.env.PLAYWRIGHT_BROWSER || "chromium";

  const fillCode = fields
    .map(({ selector, value }) =>
      `await page.fill(${JSON.stringify(selector)}, ${JSON.stringify(value)});`
    )
    .join("\n    ");

  const submitCode = submit_selector
    ? `await page.click(${JSON.stringify(submit_selector)});`
    : "";

  const playwrightScript = `
const { ${browserType} } = require("playwright");
(async () => {
  const browser = await ${browserType}.launch();
  const page = await browser.newPage();
  try {
    await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle", timeout: 30000 });
    ${fillCode}
    ${submitCode}
    const title = await page.title();
    const currentUrl = page.url();
    console.log(JSON.stringify({ title, url: currentUrl, fieldCount: ${fields.length}, success: true }));
  } finally {
    await browser.close();
  }
})().catch(e => console.log(JSON.stringify({ error: e.message, success: false })));
`;

  const { stdout, error } = await runPlaywright(playwrightScript);
  if (error) return { output: error, isError: true };

  try {
    const result = JSON.parse(stdout);
    if (!result.success) return { output: result.error || "Form fill failed", isError: true };
    return { output: `Filled ${result.fieldCount} field(s). Page: ${result.title}`, isError: false };
  } catch {
    return { output: stdout || "No output from browser", isError: true };
  }
}

export default { schema, execute };
