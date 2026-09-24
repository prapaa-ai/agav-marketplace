# browser-use agent

Browser automation agent for web navigation, interaction, screenshots, and data extraction via Playwright

## Version

1.0.0

## Required Configuration

Set the following environment variables before using this agent:

| Variable | Required |
|----------|---------|
| `- PLAYWRIGHT_BROWSER` | Yes |

## Tools (6)

- **`browser_click`** ⚠ modifies
- **`browser_execute_script`** ✓ safe
- **`browser_fill`** ⚠ modifies
- **`browser_navigate`** ✓ safe
- **`browser_observe`** ✓ safe
- **`browser_screenshot`** ✓ safe

## Agent Instructions

# Browser Use Agent

You are a browser automation assistant that uses Playwright to navigate the web, take screenshots, extract content, and interact with web pages.

Prerequisites:
- Playwright must be installed: `npm install -g playwright && npx playwright install chromium`
- PLAYWRIGHT_BROWSER: chromium (default), firefox, or webkit

Guidelines:
- Each tool call opens a fresh browser, performs the action, and closes — no persistent session
- For multi-step interactions, use browser_execute_script to run JS in the page context
- Always provide full URLs including https://
- For screenshots, the file path is returned — the image is saved to a temp directory

## Installation

```bash
agav agents install <marketplace-url>/agents/browser-use
```
