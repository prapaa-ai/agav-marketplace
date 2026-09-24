/**
 * Get detailed information about a Jenkins job
 */

export default {
  schema: {
    name: "jenkins_get_job",
    description: "Get detailed information about a specific Jenkins job including health, build history, and configuration",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Job name or path (e.g. 'my-folder/my-job')",
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

    const baseUrl = JENKINS_URL.replace(/\/+$/, "");
    const encodedName = encodeJobPath(input.name);
    const apiUrl = `${baseUrl}/job/${encodedName}/api/json`;
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

      const job = await response.json();

      const lines = [
        `Job: ${job.displayName || job.name}`,
        `URL: ${job.url}`,
        `Description: ${job.description || "None"}`,
        `Buildable: ${job.buildable}`,
        `Next build number: ${job.nextBuildNumber}`,
      ];

      if (job.healthReport && job.healthReport.length > 0) {
        lines.push(`\nHealth:`);
        for (const report of job.healthReport) {
          lines.push(`  - ${report.description} (score: ${report.score}%)`);
        }
      }

      if (job.lastBuild) {
        lines.push(`\nLast build: #${job.lastBuild.number} (${job.lastBuild.url})`);
      }
      if (job.lastSuccessfulBuild) {
        lines.push(`Last successful build: #${job.lastSuccessfulBuild.number}`);
      }
      if (job.lastFailedBuild) {
        lines.push(`Last failed build: #${job.lastFailedBuild.number}`);
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return { output: `Error getting job details: ${error.message}`, isError: true };
    }
  },
};
