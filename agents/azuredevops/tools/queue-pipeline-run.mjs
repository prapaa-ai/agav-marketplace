export default {
  schema: {
    name: "ado_queue_pipeline_run",
    description: "Queue a new run for an Azure DevOps pipeline",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "number", description: "Pipeline ID to queue" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" },
        branch: { type: "string", description: "Branch to run pipeline on (defaults to pipeline default)" }
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
    const body = {};
    if (input.branch) {
      body.resources = { repositories: { self: { refName: `refs/heads/${input.branch}` } } };
    }

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/pipelines/${input.pipeline_id}/runs?api-version=7.1`,
        {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Azure DevOps API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const run = await response.json();
      return { output: `Queued pipeline run #${run.id} — state: ${run.state}\n${run._links?.web?.href || ""}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
