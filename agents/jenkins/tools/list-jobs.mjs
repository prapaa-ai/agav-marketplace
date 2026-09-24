/**
 * List Jenkins jobs, optionally within a folder
 */

export default {
  schema: {
    name: "jenkins_list_jobs",
    description: "List Jenkins jobs with their current status and last build info",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description: "Folder path to list jobs from (optional, lists root jobs if omitted)",
        },
      },
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

    const colorToStatus = {
      blue: "SUCCESS",
      red: "FAILURE",
      yellow: "UNSTABLE",
      disabled: "DISABLED",
      notbuilt: "NOT_BUILT",
      blue_anime: "BUILDING",
      red_anime: "BUILDING",
      yellow_anime: "BUILDING",
      aborted: "ABORTED",
      aborted_anime: "BUILDING",
    };

    const baseUrl = JENKINS_URL.replace(/\/+$/, "");
    const tree = "jobs[name,url,color,lastBuild[number,result,timestamp]]";
    let apiUrl;

    if (input.folder) {
      const encodedFolder = encodeJobPath(input.folder);
      apiUrl = `${baseUrl}/job/${encodedFolder}/api/json?tree=${encodeURIComponent(tree)}`;
    } else {
      apiUrl = `${baseUrl}/api/json?tree=${encodeURIComponent(tree)}`;
    }

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
      const jobs = data.jobs || [];

      if (jobs.length === 0) {
        return { output: "No jobs found.", isError: false };
      }

      const lines = [`Found ${jobs.length} job(s)${input.folder ? ` in folder "${input.folder}"` : ""}:\n`];

      for (const job of jobs) {
        const status = colorToStatus[job.color] || job.color || "UNKNOWN";
        let lastBuildInfo = "No builds";
        if (job.lastBuild) {
          const ts = new Date(job.lastBuild.timestamp).toISOString();
          lastBuildInfo = `#${job.lastBuild.number} ${job.lastBuild.result || "IN_PROGRESS"} (${ts})`;
        }
        lines.push(
          `- ${job.name} [${status}]\n` +
            `  Last build: ${lastBuildInfo}\n` +
            `  URL: ${job.url}`
        );
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return { output: `Error listing jobs: ${error.message}`, isError: true };
    }
  },
};
