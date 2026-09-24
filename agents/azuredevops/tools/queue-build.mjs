export default {
  schema: {
    name: "ado_queue_build",
    description: "Queue a new build for an Azure DevOps build definition",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        definition_id: { type: "number", description: "Build definition ID" },
        branch: { type: "string", description: "Branch to build (defaults to main)" },
        parameters: { type: "object", description: "Optional build parameters as key-value pairs" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" }
      },
      required: ["definition_id"]
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
      definition: { id: input.definition_id },
      sourceBranch: `refs/heads/${branch}`,
      parameters: JSON.stringify(input.parameters || {})
    };

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/build/builds?api-version=7.1`,
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
      const build = await response.json();
      return {
        output: `Queued build #${build.id} for definition ${input.definition_id} on branch ${branch}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
