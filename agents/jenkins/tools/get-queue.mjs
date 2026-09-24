/**
 * Get the current Jenkins build queue
 */

export default {
  schema: {
    name: "jenkins_get_queue",
    description: "Get the current Jenkins build queue showing pending and stuck items",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  async execute(input) {
    const { JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN } = process.env;
    if (!JENKINS_URL || !JENKINS_USER || !JENKINS_API_TOKEN) {
      return { output: "Error: Missing Jenkins credentials (JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN)", isError: true };
    }

    const baseUrl = JENKINS_URL.replace(/\/+$/, "");
    const apiUrl = `${baseUrl}/queue/api/json`;
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
      const items = data.items || [];

      if (items.length === 0) {
        return { output: "Build queue is empty.", isError: false };
      }

      const lines = [`Build queue (${items.length} item(s)):\n`];

      for (const item of items) {
        const taskName = item.task?.name || "Unknown";
        const why = item.why || "Unknown reason";
        const inQueueSince = item.inQueueSince
          ? new Date(item.inQueueSince).toISOString()
          : "Unknown";
        const stuck = item.stuck ? " [STUCK]" : "";

        lines.push(
          `- #${item.id} ${taskName}${stuck}\n` +
            `  Reason: ${why}\n` +
            `  In queue since: ${inQueueSince}`
        );
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return { output: `Error getting build queue: ${error.message}`, isError: true };
    }
  },
};
