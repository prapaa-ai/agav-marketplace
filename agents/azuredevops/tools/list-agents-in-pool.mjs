export default {
  schema: {
    name: "ado_list_agents_in_pool",
    description: "List agents registered in a specific Azure DevOps agent pool",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        pool_id: { type: "number", description: "Agent pool ID (from ado_list_agent_pools)" }
      },
      required: ["pool_id"]
    }
  },
  async execute(input) {
    const { ADO_ORGANIZATION_URL, ADO_PAT } = process.env;
    if (!ADO_ORGANIZATION_URL || !ADO_PAT) {
      return { output: "Error: Missing ADO_ORGANIZATION_URL or ADO_PAT", isError: true };
    }

    const auth = Buffer.from(`:${ADO_PAT}`).toString("base64");

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/_apis/distributedtask/pools/${input.pool_id}/agents?api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const agents = data.value || [];
      if (!agents.length) return { output: `No agents found in pool #${input.pool_id}.`, isError: false };

      const lines = [`Found ${agents.length} agent(s) in pool #${input.pool_id}:\n`];
      for (const a of agents) {
        const os = a.osDescription || a.systemCapabilities?.["Agent.OS"] || "unknown";
        lines.push(`[${a.id}] ${a.name} — status: ${a.status || "unknown"}, os: ${os}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
