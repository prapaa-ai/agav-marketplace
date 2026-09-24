export default {
  schema: {
    name: "ado_preview_pipeline_run",
    description: "Preview the final compiled YAML of an Azure DevOps pipeline without executing it",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "number", description: "Pipeline ID to preview" },
        branch: { type: "string", description: "Branch to preview against (defaults to main)" },
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

    const auth = Buffer.from(`:${ADO_PAT}`).toString("base64");
    const branch = input.branch || "main";
    const body = {
      previewRun: true,
      resources: { repositories: { self: { refName: `refs/heads/${branch}` } } },
      variables: {}
    };

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/pipelines/${input.pipeline_id}/runs?api-version=7.1`,
        {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Azure DevOps API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const data = await response.json();
      const yaml = data.finalYaml || "(no YAML returned)";
      if (yaml.length > 5000) {
        return { output: yaml.slice(0, 5000) + "\n... [truncated]", isError: false };
      }
      return { output: yaml, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
