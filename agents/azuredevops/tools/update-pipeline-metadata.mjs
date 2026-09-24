export default {
  schema: {
    name: "ado_update_pipeline_metadata",
    description: "Update the name or folder of an existing Azure DevOps pipeline",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "number", description: "Pipeline ID to update" },
        name: { type: "string", description: "New pipeline name (optional)" },
        folder: { type: "string", description: "New folder path (optional)" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" }
      },
      required: ["pipeline_id"]
    }
  },
  async execute(input) {
    const { ADO_ORGANIZATION_URL, ADO_PAT, ADO_PROJECT } = process.env;
    if (!ADO_ORGANIZATION_URL || !ADO_PAT) {
      return { output: "Error: Missing ADO_ORGANIZATION_URL or ADO_PAT", isError: true };
    }
    const project = encodeURIComponent(input.project || ADO_PROJECT || "");
    if (!project) return { output: "Error: No project specified. Set ADO_PROJECT or pass project parameter.", isError: true };

    if (!input.name && !input.folder) {
      return { output: "Error: At least one of name or folder must be provided.", isError: true };
    }

    const auth = Buffer.from(`:${ADO_PAT}`).toString("base64");
    const body = {};
    if (input.name) body.name = input.name;
    if (input.folder) body.folder = input.folder;

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/pipelines/${input.pipeline_id}?api-version=7.1`,
        {
          method: "PATCH",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Azure DevOps API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      return { output: `Updated pipeline #${input.pipeline_id}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
