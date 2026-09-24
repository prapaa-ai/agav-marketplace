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
    name: "gcp_list_gke_clusters",
    description: "List all GKE (Google Kubernetes Engine) clusters in the GCP project across all locations",
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
      // "-" as location means all locations
      const url  = `https://container.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/-/clusters`;
      const data = await gcpFetch(token, url);
      const clusters = data.clusters || [];

      if (clusters.length === 0) {
        return { output: "No GKE clusters found in this project.", isError: false };
      }

      const lines = clusters.map(c => {
        const location   = c.location   || "unknown";
        const version    = c.currentMasterVersion || c.initialClusterVersion || "unknown";
        const nodeCount  = c.currentNodeCount !== undefined ? c.currentNodeCount : "unknown";
        const status     = c.status     || "unknown";
        return `${c.name} — zone: ${location}, k8s: ${version}, nodes: ${nodeCount}, status: ${status}`;
      });

      return { output: `GKE Clusters (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
