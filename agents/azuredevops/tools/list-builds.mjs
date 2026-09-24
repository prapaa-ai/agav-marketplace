export default {
  schema: {
    name: "ado_list_builds",
    description: "List recent builds in an Azure DevOps project",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" },
        status_filter: { type: "string", description: "Filter by status: inProgress, completed, cancelling, postponed, notStarted, all", default: "all" },
        max_results: { type: "number", description: "Maximum results to return", default: 15 }
      }
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
    const params = new URLSearchParams({
      "$top": String(input.max_results || 15),
      "api-version": "7.1"
    });
    if (input.status_filter && input.status_filter !== "all") {
      params.set("statusFilter", input.status_filter);
    }

    try {
      const response = await fetch(`${ADO_ORGANIZATION_URL}/${project}/_apis/build/builds?${params}`, {
        headers: { Authorization: `Basic ${auth}` }
      });
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const builds = data.value || [];
      if (!builds.length) return { output: "No builds found.", isError: false };

      const lines = [`Found ${builds.length} build(s):\n`];
      for (const b of builds) {
        const date = new Date(b.startTime || b.queueTime).toLocaleDateString();
        const result = b.result || b.status;
        lines.push(`• #${b.buildNumber} — ${result} (${date})\n  ${b.definition.name} | ${b._links?.web?.href || ""}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
