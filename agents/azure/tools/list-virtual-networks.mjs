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
    name: "azure_list_virtual_networks",
    description: "List Azure Virtual Networks in the subscription with their address spaces and subnets",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        resource_group: { type: "string", description: "Scope listing to a specific resource group name" }
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
      const path = input.resource_group
        ? `/resourceGroups/${encodeURIComponent(input.resource_group)}/providers/Microsoft.Network/virtualNetworks`
        : "/providers/Microsoft.Network/virtualNetworks";

      const data  = await azureFetch(token, `${base}${path}?api-version=2023-05-01`);
      const vnets = data.value || [];

      if (vnets.length === 0) {
        return { output: "No virtual networks found.", isError: false };
      }

      const lines = vnets.map(v => {
        const location  = v.location || "unknown";
        const prefixes  = v.properties?.addressSpace?.addressPrefixes || [];
        const addrSpace = prefixes.length > 0 ? prefixes.join(", ") : "no address space";
        const subnetCount = (v.properties?.subnets || []).length;
        return `${v.name} — location: ${location}, address space: ${addrSpace}, subnets: ${subnetCount}`;
      });

      return { output: `Virtual Networks (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
