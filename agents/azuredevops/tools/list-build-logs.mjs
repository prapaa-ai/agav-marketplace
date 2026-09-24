export default {
  schema: {
    name: "ado_list_build_logs",
    description: "List the logs available for a specific Azure DevOps build",
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
    if (!project) return { output: "Error: No project specified. Set ADO_PROJECT or pass project parameter.", isError: true };

    const auth = Buffer.from(`:${ADO_PAT}`).toString("base64");

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/build/builds/${input.build_id}/logs?api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const logs = data.value || [];
      if (!logs.length) return { output: `No logs found for build #${input.build_id}.`, isError: false };

      const lines = [`Found ${logs.length} log(s) for build #${input.build_id}:\n`];
      for (const log of logs) {
        lines.push(`[${log.id}] ${log.url} (${log.lineCount ?? "?"} lines)`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
