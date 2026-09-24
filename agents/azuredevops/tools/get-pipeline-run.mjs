export default {
  schema: {
    name: "ado_get_pipeline_run",
    description: "Get details of a specific Azure DevOps pipeline run",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "number", description: "Pipeline ID" },
        run_id: { type: "number", description: "Run ID" },
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
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Azure DevOps API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const r = await response.json();
      const created = r.createdDate ? new Date(r.createdDate).toLocaleString() : "N/A";
      const finished = r.finishedDate ? new Date(r.finishedDate).toLocaleString() : "In progress";
      const lines = [
        `Run #${r.id} — ${r.name}`,
        `State: ${r.state}`,
        `Result: ${r.result || "N/A"}`,
        `Pipeline: ${r.pipeline?.name || "N/A"}`,
        `Created: ${created}`,
        `Finished: ${finished}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
