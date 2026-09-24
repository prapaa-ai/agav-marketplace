import { createSign } from "node:crypto";

async function getGCPToken(serviceAccountKeyJson) {
  const key = JSON.parse(serviceAccountKeyJson);
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  const unsigned  = `${header}.${payload}`;
  const sign      = createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(key.private_key, "base64url");
  const jwt       = `${unsigned}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString(),
  });
  if (!tokenResponse.ok) throw new Error(`GCP auth failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function gcpFetch(token, url) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GCP API error (${response.status}): ${err.slice(0, 200)}`);
  }
  return response.json();
}

export default {
  schema: {
    name: "gcp_list_billing_services",
    description: "List GCP billing services (Google Cloud services that can incur charges)",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        page_size: { type: "number", description: "Number of services to return (default: 20, max: 5000)" }
      },
      required: []
    }
  },

  async execute(input) {
    const { GCP_SERVICE_ACCOUNT_KEY_JSON } = process.env;
    if (!GCP_SERVICE_ACCOUNT_KEY_JSON) {
      return { output: "Error: Missing GCP_SERVICE_ACCOUNT_KEY_JSON", isError: true };
    }

    const pageSize = Math.min(input.page_size || 20, 5000);

    try {
      const token = await getGCPToken(GCP_SERVICE_ACCOUNT_KEY_JSON);
      const url   = `https://cloudbilling.googleapis.com/v1/services?pageSize=${pageSize}`;
      const data  = await gcpFetch(token, url);
      const services = data.services || [];

      if (services.length === 0) {
        return { output: "No billing services found.", isError: false };
      }

      const lines = services.map(s => {
        const serviceId = s.serviceId || (s.name || "").split("/").pop() || "unknown";
        return `${s.displayName} (serviceId: ${serviceId})`;
      });

      return { output: `GCP Billing Services (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
