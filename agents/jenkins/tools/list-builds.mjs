/**
 * List recent builds for a Jenkins job
 */

export default {
  schema: {
    name: "jenkins_list_builds",
    description: "List recent builds for a Jenkins job with their status, duration, and timestamp",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Job name or path (e.g. 'my-folder/my-job')",
        },
        limit: {
          type: "number",
          description: "Maximum number of builds to return (default: 10)",
        },
      },
      required: ["name"],
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
    const limit = input.limit || 10;
    const tree = `builds[number,result,timestamp,duration,displayName]{0,${limit}}`;
    const apiUrl = `${baseUrl}/job/${encodedName}/api/json?tree=${encodeURIComponent(tree)}`;
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

      const data = await response.json();
      const builds = data.builds || [];

      if (builds.length === 0) {
        return { output: `No builds found for job "${input.name}".`, isError: false };
      }

      const lines = [`Builds for "${input.name}" (showing ${builds.length}):\n`];

      for (const build of builds) {
        const ts = new Date(build.timestamp).toISOString();
        const duration = formatDuration(build.duration);
        const result = build.result || "IN_PROGRESS";
        const displayName = build.displayName || `#${build.number}`;
        lines.push(`  #${build.number} ${displayName} - ${result} | Duration: ${duration} | ${ts}`);
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return { output: `Error listing builds: ${error.message}`, isError: true };
    }
  },
};
