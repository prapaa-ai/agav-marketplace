export default {
  schema: {
    name: "ado_list_service_connections",
    description: "List service connections (endpoints) in an Azure DevOps project",
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
        `${ADO_ORGANIZATION_URL}/${project}/_apis/serviceendpoint/endpoints?api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const endpoints = data.value || [];
      if (!endpoints.length) return { output: "No service connections found.", isError: false };

      const lines = [`Found ${endpoints.length} service connection(s):\n`];
      for (const e of endpoints) {
        const authorized = e.isReady === true ? "yes" : e.isReady === false ? "no" : "unknown";
        lines.push(`[${e.id}] ${e.name} (${e.type}) — authorized: ${authorized}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
