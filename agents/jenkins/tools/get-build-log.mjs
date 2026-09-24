/**
 * Get console output (log) for a Jenkins build
 */

export default {
  schema: {
    name: "jenkins_get_build_log",
    description: "Get the console output log for a specific Jenkins build, optionally limited to the last N lines",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Job name or path (e.g. 'my-folder/my-job')",
        },
        number: {
          type: "number",
          description: "Build number",
        },
        tail_lines: {
          type: "number",
          description: "Number of lines to return from the end of the log (default: 100)",
        },
      },
      required: ["name", "number"],
    },
  },
  async execute(input) {
    const { JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN } = process.env;
    if (!JENKINS_URL || !JENKINS_USER || !JENKINS_API_TOKEN) {
      return { output: "Error: Missing Jenkins credentials (JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN)", isError: true };
    }

    function encodeJobPath(name) {
      return name.split("/").map(encodeURIComponent).join("/job/");
    }

    const baseUrl = JENKINS_URL.replace(/\/+$/, "");
    const encodedName = encodeJobPath(input.name);
    const apiUrl = `${baseUrl}/job/${encodedName}/${input.number}/consoleText`;
    const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`).toString("base64");
    const tailLines = input.tail_lines || 100;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        return {
          output: `Jenkins API error (${response.status}): ${response.statusText}`,
          isError: true,
        };
      }

      let text = await response.text();
      const maxChars = 5000;
      let truncatedByLines = false;
      let truncatedByChars = false;

      // Truncate to last N lines
      const allLines = text.split("\n");
      if (allLines.length > tailLines) {
        text = allLines.slice(-tailLines).join("\n");
        truncatedByLines = true;
      }

      // Truncate to max characters
      if (text.length > maxChars) {
        text = text.slice(-maxChars);
        truncatedByChars = true;
      }

      const header = `Console output for ${input.name} #${input.number}`;
      const warnings = [];
      if (truncatedByLines) {
        warnings.push(`showing last ${tailLines} of ${allLines.length} lines`);
      }
      if (truncatedByChars) {
        warnings.push(`truncated to ${maxChars} characters`);
      }
      const warningStr = warnings.length > 0 ? ` (${warnings.join(", ")})` : "";

      return {
        output: `${header}${warningStr}:\n\n${text}`,
        isError: false,
      };
    } catch (error) {
      return { output: `Error getting build log: ${error.message}`, isError: true };
    }
  },
};
