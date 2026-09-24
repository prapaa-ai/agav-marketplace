export default {
  schema: {
    name: "ado_list_environments",
    description: "List deployment environments in an Azure DevOps project",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" }
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

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/distributedtask/environments?api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const envs = data.value || [];
      if (!envs.length) return { output: "No environments found.", isError: false };

      const lines = [`Found ${envs.length} environment(s):\n`];
      for (const e of envs) {
        lines.push(`[${e.id}] ${e.name} — ${e.description || "(no description)"}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
