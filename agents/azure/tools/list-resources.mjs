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
    name: "azure_list_resources",
    description: "List Azure resources in the subscription, optionally scoped by resource group or filtered by resource type",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        resource_group: { type: "string", description: "Scope listing to a specific resource group name" },
        resource_type:  { type: "string", description: "Filter by resource type, e.g. Microsoft.Compute/virtualMachines" }
      },
      required: []
    }
  },

  async execute(input) {
    const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID } = process.env;
    if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_SUBSCRIPTION_ID) {
      return { output: "Error: Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, or AZURE_SUBSCRIPTION_ID", isError: true };
    }

    try {
      const token = await getAzureToken(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET);

      const base = `https://management.azure.com/subscriptions/${AZURE_SUBSCRIPTION_ID}`;
      let path = input.resource_group
        ? `/resourceGroups/${encodeURIComponent(input.resource_group)}/resources`
        : "/resources";

      const params = new URLSearchParams({ "api-version": "2021-04-01" });
      if (input.resource_type) {
        params.set("$filter", `resourceType eq '${input.resource_type}'`);
      }

      const data  = await azureFetch(token, `${base}${path}?${params}`);
      const items = data.value || [];

      if (items.length === 0) {
        return { output: "No resources found matching the criteria.", isError: false };
      }

      const lines = items.map(r => {
        const rg       = r.resourceGroup || (r.id || "").split("/resourceGroups/")[1]?.split("/")[0] || "unknown";
        const location = r.location || "global";
        return `${r.name} (${r.type}) — ${location}, rg: ${rg}`;
      });

      return { output: `Resources (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
