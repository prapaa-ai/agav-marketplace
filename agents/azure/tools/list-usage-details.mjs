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

async function azureFetch(token, url) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure API error (${response.status}): ${err.slice(0, 200)}`);
  }
  return response.json();
}

export default {
  schema: {
    name: "azure_list_usage_details",
    description: "List Azure consumption usage details for a date range — shows per-resource cost line items",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
        end_date:   { type: "string", description: "End date in YYYY-MM-DD format" },
        top:        { type: "number", description: "Maximum number of records to return (default: 20)" }
      },
      required: ["start_date", "end_date"]
    }
  },

  async execute(input) {
    const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID } = process.env;
    if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_SUBSCRIPTION_ID) {
      return { output: "Error: Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, or AZURE_SUBSCRIPTION_ID", isError: true };
    }

    const { start_date, end_date, top = 20 } = input;

    try {
      const token = await getAzureToken(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET);

      const params = new URLSearchParams({
        "api-version": "2021-10-01",
        "$top": String(top),
        "$filter": `properties/usageStart ge '${start_date}' and properties/usageEnd le '${end_date}'`,
      });

      const url  = `https://management.azure.com/subscriptions/${AZURE_SUBSCRIPTION_ID}/providers/Microsoft.Consumption/usageDetails?${params}`;
      const data = await azureFetch(token, url);
      const items = data.value || [];

      if (items.length === 0) {
        return { output: `No usage details found for ${start_date} to ${end_date}.`, isError: false };
      }

      const lines = items.map(item => {
        const p            = item.properties || {};
        const date         = (p.usageStart || "").slice(0, 10);
        const resourceName = p.resourceName || p.instanceName || item.name || "unknown";
        const resourceType = p.consumedService || p.meterCategory || "unknown";
        const cost         = parseFloat(p.pretaxCost || p.cost || p.costInBillingCurrency || 0).toFixed(4);
        const currency     = p.billingCurrency || p.currency || "USD";
        return `${date} ${resourceName} (${resourceType}) — cost: $${cost} ${currency}`;
      });

      return { output: `Usage Details (${lines.length} records, ${start_date} to ${end_date}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
