export default {
  schema: {
    name: "ado_get_build_log",
    description: "Get the contents of a specific log for an Azure DevOps build",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        build_id: { type: "number", description: "Build ID" },
        log_id: { type: "number", description: "Log ID (from ado_list_build_logs)" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" },
        start_line: { type: "number", description: "Start line number (1-based, optional)" },
        end_line: { type: "number", description: "End line number (1-based, optional)" }
      },
      required: ["build_id", "log_id"]
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

    const params = new URLSearchParams({ "api-version": "7.1" });
    if (input.start_line != null) params.set("startLine", String(input.start_line));
    if (input.end_line != null) params.set("endLine", String(input.end_line));

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/build/builds/${input.build_id}/logs/${input.log_id}?${params}`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "text/plain" } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const text = await response.text();
      if (!text.trim()) return { output: "Log is empty.", isError: false };
      if (text.length > 5000) {
        return { output: text.slice(0, 5000) + "\n... [truncated — use start_line/end_line to fetch a specific range]", isError: false };
      }
      return { output: text, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
