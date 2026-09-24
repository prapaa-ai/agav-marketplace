/**
 * Stop a running Jenkins build
 */

export default {
  schema: {
    name: "jenkins_stop_build",
    description: "Stop a currently running Jenkins build",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Job name or path (e.g. 'my-folder/my-job')",
        },
        number: {
          type: "number",
          description: "Build number to stop",
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
    const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`).toString("base64");

    try {
      // Fetch CSRF crumb
      const headers = {
        Authorization: `Basic ${auth}`,
      };

      try {
        const crumbResponse = await fetch(`${baseUrl}/crumbIssuer/api/json`, {
          headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
        });
        if (crumbResponse.ok) {
          const crumbData = await crumbResponse.json();
          headers[crumbData.crumbRequestField] = crumbData.crumb;
        }
      } catch {
        // Crumb endpoint not available, continue without it
      }

      const apiUrl = `${baseUrl}/job/${encodedName}/${input.number}/stop`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
      });

      // Jenkins typically returns 302 on successful stop
      if (response.ok || response.status === 302) {
        return {
          output: `Build #${input.number} of "${input.name}" has been stopped.`,
          isError: false,
        };
      }

      return {
        output: `Jenkins API error (${response.status}): ${response.statusText}`,
        isError: true,
      };
    } catch (error) {
      return { output: `Error stopping build: ${error.message}`, isError: true };
    }
  },
};
