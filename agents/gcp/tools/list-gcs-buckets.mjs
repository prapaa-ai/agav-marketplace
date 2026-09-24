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
    name: "gcp_list_gcs_buckets",
    description: "List all Google Cloud Storage buckets in the GCP project",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  async execute(_input) {
    const { GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_KEY_JSON } = process.env;
    if (!GCP_PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY_JSON) {
      return { output: "Error: Missing GCP_PROJECT_ID or GCP_SERVICE_ACCOUNT_KEY_JSON", isError: true };
    }

    try {
      const token = await getGCPToken(GCP_SERVICE_ACCOUNT_KEY_JSON);
      const url   = `https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(GCP_PROJECT_ID)}&maxResults=50`;
      const data  = await gcpFetch(token, url);
      const buckets = data.items || [];

      if (buckets.length === 0) {
        return { output: "No GCS buckets found in this project.", isError: false };
      }

      const lines = buckets.map(b => {
        const location     = b.location     || "unknown";
        const storageClass = b.storageClass || "unknown";
        const created      = (b.timeCreated || "").slice(0, 10);
        return `${b.name} — location: ${location}, storage class: ${storageClass}, created: ${created}`;
      });

      return { output: `GCS Buckets (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
