export default {
  schema: {
    name: "ado_get_build_timeline",
    description: "Get the timeline (stages, jobs, tasks) of a specific Azure DevOps build",
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
        `${ADO_ORGANIZATION_URL}/${project}/_apis/build/builds/${input.build_id}/timeline?api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const records = (data.records || []).filter(r => ["Stage", "Job", "Task"].includes(r.type));
      if (!records.length) return { output: "No timeline records found (no stages, jobs, or tasks).", isError: false };

      const lines = [`Build #${input.build_id} timeline (${records.length} record(s)):\n`];
      for (const r of records) {
        let duration = "";
        if (r.startTime && r.finishTime) {
          const ms = new Date(r.finishTime) - new Date(r.startTime);
          const secs = Math.round(ms / 1000);
          duration = secs >= 60
            ? ` (${Math.floor(secs / 60)}m ${secs % 60}s)`
            : ` (${secs}s)`;
        }
        const status = r.result || r.state || "unknown";
        const indent = r.type === "Stage" ? "" : r.type === "Job" ? "  " : "    ";
        lines.push(`${indent}${r.type}: ${r.name} — ${status}${duration}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
