export default {
  schema: {
    name: "ado_list_agent_pools",
    description: "List Azure DevOps agent pools at the organization level",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {}
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
        `${ADO_ORGANIZATION_URL}/_apis/distributedtask/pools?api-version=7.1`,
        { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        return { output: `Azure DevOps API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const pools = data.value || [];
      if (!pools.length) return { output: "No agent pools found.", isError: false };

      const lines = [`Found ${pools.length} agent pool(s):\n`];
      for (const p of pools) {
        lines.push(`[${p.id}] ${p.name} — size: ${p.size ?? "N/A"}, type: ${p.poolType || "unknown"}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
