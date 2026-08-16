/**
 * Get all components defined in a Jira project
 */

export default {
  schema: {
    name: "jira_get_project_components",
    description: "Get all components defined in a Jira project. Components are used to categorize issues within a project.",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_key: {
          type: "string",
          description: "The Jira project key (e.g., 'PROJ')",
        },
      },
      required: ["project_key"],
    },
  },
  async execute(input) {
    const { JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

    if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      return {
        output: "Error: Missing Jira credentials. Please configure JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN.",
        isError: true,
      };
    }

    const projectKey = input.project_key;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/project/${projectKey}/components`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Project '${projectKey}' not found.`,
            isError: true,
          };
        }
        const errorText = await response.text();
        return {
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const components = await response.json();

      if (!Array.isArray(components) || components.length === 0) {
        return {
          output: `No components defined in project '${projectKey}'.`,
          isError: false,
        };
      }

      const lines = [`Components in project [${projectKey}] (${components.length} total):\n`];

      for (const comp of components) {
        const name = comp.name || "Unnamed";
        const description = comp.description ? ` — ${comp.description}` : "";
        const lead = comp.lead?.displayName ? ` (lead: ${comp.lead.displayName})` : "";
        lines.push(`• ${name}${description}${lead}`);
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return {
        output: `Error retrieving project components: ${error.message}`,
        isError: true,
      };
    }
  },
};
