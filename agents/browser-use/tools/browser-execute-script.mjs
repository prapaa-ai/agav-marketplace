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
  name: "browser_execute_script",
  description: "Navigate to a URL and execute a JavaScript expression in the page context. Returns the serialized result of the expression.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to navigate to (include https://)"
      },
      script: {
        type: "string",
        description: "JavaScript expression to evaluate in the page context (e.g. 'document.title' or 'document.querySelectorAll(\"a\").length')"
      }
    },
    required: ["url", "script"]
  }
};

export async function execute({ url, script: userScript }) {
  const browserType = process.env.PLAYWRIGHT_BROWSER || "chromium";

  const playwrightScript = `
const { ${browserType} } = require("playwright");
(async () => {
  const browser = await ${browserType}.launch();
  const page = await browser.newPage();
  try {
    await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle", timeout: 30000 });
    const result = await page.evaluate(${JSON.stringify(userScript)});
    const serialized = (result !== null && typeof result === "object")
      ? JSON.stringify(result, null, 2)
      : String(result);
    console.log(JSON.stringify({ result: serialized, success: true }));
  } finally {
    await browser.close();
  }
})().catch(e => console.log(JSON.stringify({ error: e.message, success: false })));
`;

  const { stdout, error } = await runPlaywright(playwrightScript);
  if (error) return { output: error, isError: true };

  try {
    const result = JSON.parse(stdout);
    if (!result.success) return { output: result.error || "Script execution failed", isError: true };
    return { output: result.result, isError: false };
  } catch {
    return { output: stdout || "No output from browser", isError: true };
  }
}

export default { schema, execute };
