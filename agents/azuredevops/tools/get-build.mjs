export default {
  schema: {
    name: "ado_get_build",
    description: "Get details of a specific Azure DevOps build including logs summary",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        build_id: { type: "number", description: "Build ID" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" }
      },
      required: ["build_id"]
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

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/build/builds/${input.build_id}?api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const b = await response.json();
      const start = b.startTime ? new Date(b.startTime).toLocaleString() : "Not started";
      const finish = b.finishTime ? new Date(b.finishTime).toLocaleString() : "In progress";

      const lines = [
        `Build #${b.buildNumber} — ${b.result || b.status}`,
        `Pipeline: ${b.definition.name}`,
        `Branch: ${b.sourceBranch?.replace("refs/heads/", "") || "unknown"} | Commit: ${b.sourceVersion?.slice(0, 8) || "?"}`,
        `Started: ${start}`,
        `Finished: ${finish}`,
        ``,
        `${b._links?.web?.href || ""}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
