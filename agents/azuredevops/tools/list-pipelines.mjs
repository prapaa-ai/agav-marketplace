export default {
  schema: {
    name: "ado_list_pipelines",
    description: "List pipelines in an Azure DevOps project",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" },
        max_results: { type: "number", description: "Maximum results to return", default: 20 }
      }
    }
  },
  async execute(input) {
    const { ADO_ORGANIZATION_URL, ADO_PAT, ADO_PROJECT } = process.env;
    if (!ADO_ORGANIZATION_URL || !ADO_PAT) {
      return { output: "Error: Missing ADO_ORGANIZATION_URL or ADO_PAT", isError: true };
    }

    const project = encodeURIComponent(input.project || ADO_PROJECT || "");
    if (!project) return { output: "Error: No project specified. Set ADO_PROJECT or pass project parameter.", isError: true };

    const auth = Buffer.from(`:${ADO_PAT}`).toString("base64");
    const top = input.max_results || 20;

    try {
      const response = await fetch(`${ADO_ORGANIZATION_URL}/${project}/_apis/pipelines?$top=${top}&api-version=7.1`, {
        headers: { Authorization: `Basic ${auth}` }
      });
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const pipelines = data.value || [];
      if (!pipelines.length) return { output: "No pipelines found.", isError: false };

      const lines = [`Found ${pipelines.length} pipeline(s):\n`];
      for (const p of pipelines) {
        lines.push(`• [${p.id}] ${p.name}\n  Folder: ${p.folder || "/"}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
