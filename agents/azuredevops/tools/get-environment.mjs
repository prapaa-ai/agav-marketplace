export default {
  schema: {
    name: "ado_get_environment",
    description: "Get details of a specific Azure DevOps deployment environment",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        environment_id: { type: "number", description: "Environment ID" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" }
      },
      required: ["environment_id"]
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
        `${ADO_ORGANIZATION_URL}/${project}/_apis/distributedtask/environments/${input.environment_id}?api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Azure DevOps API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const e = await response.json();
      const created = e.createdOn ? new Date(e.createdOn).toLocaleString() : "N/A";
      const lines = [
        `Environment: ${e.name}`,
        `ID: ${e.id}`,
        `Description: ${e.description || "(none)"}`,
        `Created: ${created}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
