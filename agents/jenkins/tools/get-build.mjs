/**
 * Get detailed information about a specific Jenkins build
 */

export default {
  schema: {
    name: "jenkins_get_build",
    description: "Get detailed information about a specific Jenkins build including result, duration, changes, and parameters",
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

    function formatDuration(ms) {
      if (!ms || ms <= 0) return "N/A";
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      if (minutes === 0) return `${seconds}s`;
      return `${minutes}m ${seconds}s`;
    }

    const baseUrl = JENKINS_URL.replace(/\/+$/, "");
    const encodedName = encodeJobPath(input.name);
    const apiUrl = `${baseUrl}/job/${encodedName}/${input.number}/api/json`;
    const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`).toString("base64");

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return {
          output: `Jenkins API error (${response.status}): ${response.statusText}`,
          isError: true,
        };
      }

      const build = await response.json();
      const ts = new Date(build.timestamp).toISOString();
      const duration = formatDuration(build.duration);

      const lines = [
        `Build #${build.number} - ${build.fullDisplayName || build.displayName || input.name}`,
        `Result: ${build.result || "IN_PROGRESS"}`,
        `URL: ${build.url}`,
        `Timestamp: ${ts}`,
        `Duration: ${duration}`,
        `Built on: ${build.builtOn || "master"}`,
      ];

      // Extract parameters from actions
      const paramsAction = (build.actions || []).find(
        (a) => a._class && a._class.includes("ParametersAction")
      );
      if (paramsAction && paramsAction.parameters && paramsAction.parameters.length > 0) {
        lines.push(`\nParameters:`);
        for (const param of paramsAction.parameters) {
          lines.push(`  ${param.name} = ${param.value}`);
        }
      }

      // Change set summary
      if (build.changeSet && build.changeSet.items && build.changeSet.items.length > 0) {
        lines.push(`\nChanges (${build.changeSet.items.length}):`);
        for (const change of build.changeSet.items.slice(0, 10)) {
          const author = change.author?.fullName || change.author?.id || "unknown";
          const msg = change.msg || change.comment || "No message";
          lines.push(`  - ${msg.split("\n")[0]} (${author})`);
        }
        if (build.changeSet.items.length > 10) {
          lines.push(`  ... and ${build.changeSet.items.length - 10} more changes`);
        }
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return { output: `Error getting build details: ${error.message}`, isError: true };
    }
  },
};
