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
    name: "gcp_list_compute_instances",
    description: "List GCP Compute Engine VM instances across all zones or a specific zone",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        zone: { type: "string", description: "Specific zone to list instances from (e.g., us-central1-a). Omit to list all zones." }
      },
      required: []
    }
  },

  async execute(input) {
    const { GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_KEY_JSON } = process.env;
    if (!GCP_PROJECT_ID || !GCP_SERVICE_ACCOUNT_KEY_JSON) {
      return { output: "Error: Missing GCP_PROJECT_ID or GCP_SERVICE_ACCOUNT_KEY_JSON", isError: true };
    }

    try {
      const token = await getGCPToken(GCP_SERVICE_ACCOUNT_KEY_JSON);
      const base  = `https://compute.googleapis.com/compute/v1/projects/${GCP_PROJECT_ID}`;

      const instances = [];

      if (input.zone) {
        const data = await gcpFetch(token, `${base}/zones/${encodeURIComponent(input.zone)}/instances`);
        for (const inst of data.items || []) {
          instances.push({ ...inst, _zone: input.zone });
        }
      } else {
        const data = await gcpFetch(token, `${base}/aggregatedList?maxResults=500`);
        for (const [zoneKey, zoneData] of Object.entries(data.items || {})) {
          const zoneName = zoneKey.replace("zones/", "");
          for (const inst of zoneData.instances || []) {
            instances.push({ ...inst, _zone: zoneName });
          }
        }
      }

      if (instances.length === 0) {
        return { output: "No Compute Engine instances found.", isError: false };
      }

      const lines = instances.map(inst => {
        const machineType = (inst.machineType || "").split("/").pop() || "unknown";
        const status      = inst.status || "unknown";
        const zone        = inst._zone || (inst.zone || "").split("/").pop() || "unknown";
        const internalIp  = inst.networkInterfaces?.[0]?.networkIP || "no internal IP";
        const externalIp  = inst.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
        const ipPart      = externalIp ? `${internalIp}, ext: ${externalIp}` : internalIp;
        return `${inst.name} (${machineType}) — status: ${status}, zone: ${zone}, IPs: ${ipPart}`;
      });

      return { output: `Compute Instances (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
