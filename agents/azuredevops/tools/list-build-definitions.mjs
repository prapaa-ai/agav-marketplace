export default {
  schema: {
    name: "ado_list_build_definitions",
    description: "List build definitions in an Azure DevOps project",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" },
        top: { type: "number", description: "Maximum number of definitions to return (defaults to 50)" }
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
    const top = input.top || 50;

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/build/definitions?api-version=7.1&$top=${top}`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const defs = data.value || [];
      if (!defs.length) return { output: "No build definitions found.", isError: false };

      const lines = [`Found ${defs.length} build definition(s):\n`];
      for (const d of defs) {
        const queue = d.queue?.name || d.queue?.pool?.name || "unknown";
        const path = d.path || "/";
        lines.push(`[${d.id}] ${d.name} (queue: ${queue}, path: ${path})`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
