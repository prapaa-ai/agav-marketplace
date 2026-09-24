/**
 * Trigger a new Jenkins build
 */

export default {
  schema: {
    name: "jenkins_trigger_build",
    description: "Trigger a new build for a Jenkins job, optionally with parameters",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Job name or path (e.g. 'my-folder/my-job')",
        },
        parameters: {
          type: "object",
          description: "Build parameters as key-value pairs (optional)",
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
        // If 404 or other error, crumb protection may be disabled; continue without it
      } catch {
        // Crumb endpoint not available, continue without it
      }

      let apiUrl;
      if (input.parameters && Object.keys(input.parameters).length > 0) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(input.parameters)) {
          params.append(key, String(value));
        }
        apiUrl = `${baseUrl}/job/${encodedName}/buildWithParameters?${params.toString()}`;
      } else {
        apiUrl = `${baseUrl}/job/${encodedName}/build`;
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
      });

      if (response.status === 201) {
        const location = response.headers.get("Location") || "";
        const lines = [`Build triggered successfully for "${input.name}".`];
        if (location) {
          lines.push(`Queue item URL: ${location}`);
        }
        if (input.parameters && Object.keys(input.parameters).length > 0) {
          lines.push(`Parameters: ${JSON.stringify(input.parameters)}`);
        }
        return { output: lines.join("\n"), isError: false };
      }

      return {
        output: `Jenkins API error (${response.status}): ${response.statusText}`,
        isError: true,
      };
    } catch (error) {
      return { output: `Error triggering build: ${error.message}`, isError: true };
    }
  },
};
