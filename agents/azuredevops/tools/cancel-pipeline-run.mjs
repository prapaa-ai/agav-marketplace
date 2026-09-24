export default {
  schema: {
    name: "ado_cancel_pipeline_run",
    description: "Cancel a running Azure DevOps pipeline run",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "number", description: "Pipeline ID" },
        run_id: { type: "number", description: "Run ID to cancel" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" }
      },
      required: ["pipeline_id", "run_id"]
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
        `${ADO_ORGANIZATION_URL}/${project}/_apis/pipelines/${input.pipeline_id}/runs/${input.run_id}?api-version=7.1`,
        {
          method: "PATCH",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ state: "canceling" })
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Azure DevOps API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      return { output: `Canceling pipeline run #${input.run_id}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
