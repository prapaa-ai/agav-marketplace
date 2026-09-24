async function getAzureToken(tenantId, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://management.azure.com/.default",
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }
  );
  if (!response.ok) throw new Error(`Auth failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.access_token;
}

export default {
  schema: {
    name: "azure_get_cost_summary",
    description: "Get Azure cost summary for a date range using Cost Management, grouped by ResourceGroup, ServiceName, or other dimensions",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
        end_date:   { type: "string", description: "End date in YYYY-MM-DD format" },
        group_by:   { type: "string", description: "Dimension to group by: ResourceGroup, ServiceName, ResourceType, Location (default: ResourceGroup)" }
      },
      required: ["start_date", "end_date"]
    }
  },

  async execute(input) {
    const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID } = process.env;
    if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_SUBSCRIPTION_ID) {
      return { output: "Error: Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, or AZURE_SUBSCRIPTION_ID", isError: true };
    }

    const { start_date, end_date, group_by = "ResourceGroup" } = input;

    try {
      const token = await getAzureToken(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET);

      const url = `https://management.azure.com/subscriptions/${AZURE_SUBSCRIPTION_ID}/providers/Microsoft.CostManagement/query?api-version=2023-03-01`;

      const payload = {
        type: "Usage",
        timeframe: "Custom",
        timePeriod: { from: start_date, to: end_date },
        dataset: {
          granularity: "None",
          aggregation: {
            totalCost: { name: "Cost", function: "Sum" }
          },
          grouping: [{ type: "Dimension", name: group_by }]
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      if (!response.ok) {
        return { output: `Cost Management error (${response.status}): ${text.slice(0, 300)}`, isError: true };
      }

      const data = JSON.parse(text);
      const columns = (data.properties?.columns || []).map(c => c.name);
      const rows    = data.properties?.rows || [];

      if (rows.length === 0) {
        return { output: `No cost data found for ${start_date} to ${end_date}.`, isError: false };
      }

      // Find column indices
      const costIdx  = columns.findIndex(c => c.toLowerCase().includes("cost"));
      const groupIdx = columns.findIndex(c => c.toLowerCase() === group_by.toLowerCase() || c.toLowerCase().includes("group") || c.toLowerCase().includes("service") || c.toLowerCase().includes("resource"));
      const currIdx  = columns.findIndex(c => c.toLowerCase().includes("currency"));

      const costMap = {};
      let currency  = "USD";

      for (const row of rows) {
        const group = groupIdx >= 0 ? (row[groupIdx] || "(unknown)") : "(total)";
        const cost  = costIdx  >= 0 ? parseFloat(row[costIdx]  || 0) : 0;
        if (currIdx >= 0 && row[currIdx]) currency = row[currIdx];
        costMap[group] = (costMap[group] || 0) + cost;
      }

      const entries = Object.entries(costMap)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `  ${k.padEnd(50)} $${v.toFixed(4)} ${currency}`);

      const total  = Object.values(costMap).reduce((a, b) => a + b, 0);
      const header = `Azure Cost Summary (${start_date} to ${end_date}), grouped by ${group_by}:`;
      const footer = `  ${"TOTAL".padEnd(50)} $${total.toFixed(4)} ${currency}`;

      return { output: [header, ...entries, "  " + "-".repeat(60), footer].join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
