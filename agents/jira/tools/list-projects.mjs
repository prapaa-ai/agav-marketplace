/**
 * List all Jira projects accessible to the authenticated user
 */

export default {
  schema: {
    name: "jira_list_projects",
    description: "List all Jira projects accessible to the authenticated user. Returns project key, name, type, and category.",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "Maximum number of projects to return (default: 50)",
          default: 50,
        },
      },
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

    const maxResults = input.max_results || 50;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/project/search?maxResults=${maxResults}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const data = await response.json();
      const projects = data.values || [];

      if (projects.length === 0) {
        return {
          output: "No projects found.",
          isError: false,
        };
      }

      const lines = [`Found ${projects.length} project(s):\n`];

      for (const project of projects) {
        const key = project.key;
        const name = project.name;
        const type = project.projectTypeKey || "unknown";
        const category = project.projectCategory?.name;

        const meta = category ? `${type}, ${category}` : type;
        lines.push(`[${key}] ${name} (${meta})`);
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return {
        output: `Error listing projects: ${error.message}`,
        isError: true,
      };
    }
  },
};
