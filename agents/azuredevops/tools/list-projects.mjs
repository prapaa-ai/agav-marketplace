export default {
  schema: {
    name: "ado_list_projects",
    description: "List all projects in the Azure DevOps organization",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        max_results: { type: "number", description: "Maximum results to return", default: 20 }
      }
    }
  },
  async execute(input) {
    const { ADO_ORGANIZATION_URL, ADO_PAT } = process.env;
    if (!ADO_ORGANIZATION_URL || !ADO_PAT) {
      return { output: "Error: Missing ADO_ORGANIZATION_URL or ADO_PAT", isError: true };
    }

    const auth = Buffer.from(`:${ADO_PAT}`).toString("base64");
    const top = input.max_results || 20;

    try {
      const response = await fetch(`${ADO_ORGANIZATION_URL}/_apis/projects?$top=${top}&api-version=7.1`, {
        headers: { Authorization: `Basic ${auth}` }
      });
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const projects = data.value || [];
      if (!projects.length) return { output: "No projects found.", isError: false };

      const lines = [`Found ${projects.length} project(s):\n`];
      for (const p of projects) {
        lines.push(`• ${p.name} (ID: ${p.id})\n  ${p.description || "No description"}\n  State: ${p.state}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
