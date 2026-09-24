export default {
  schema: {
    name: "ado_list_pipeline_runs",
    description: "List recent runs for a specific Azure DevOps pipeline",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "number", description: "Pipeline ID" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" },
        max_results: { type: "number", description: "Maximum results to return", default: 10 }
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
    if (!project) return { output: "Error: No project specified.", isError: true };

    const auth = Buffer.from(`:${ADO_PAT}`).toString("base64");
    const top = input.max_results || 10;

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/pipelines/${input.pipeline_id}/runs?$top=${top}&api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const runs = data.value || [];
      if (!runs.length) return { output: "No runs found.", isError: false };

      const lines = [`Found ${runs.length} run(s) for pipeline ${input.pipeline_id}:\n`];
      for (const r of runs) {
        const date = new Date(r.createdDate).toLocaleDateString();
        lines.push(`• Run #${r.id} — ${r.result || r.state} (${date})\n  ${r._links?.web?.href || ""}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
