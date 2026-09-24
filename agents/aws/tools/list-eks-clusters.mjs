import { createHmac, createHash } from "node:crypto";

function hmac(key, string, encoding) {
  return createHmac("sha256", key).update(string, "utf8").digest(encoding);
}

function hash(string) {
  return createHash("sha256").update(string, "utf8").digest("hex");
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate    = hmac("AWS4" + key, dateStamp);
  const kRegion  = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  const kSigning = hmac(kService, "aws4_request");
  return kSigning;
}

async function awsFetch({ service, region, method = "GET", path = "/", queryString = "", body = "", contentType, target, customHost, accessKeyId, secretAccessKey }) {
  const now = new Date();
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const host      = customHost || `${service}.${region}.amazonaws.com`;

  const payloadHash = hash(body);

  const headersMap = { "host": host, "x-amz-date": amzDate };
  if (contentType) headersMap["content-type"] = contentType;
  if (target)      headersMap["x-amz-target"]  = target;

  const sortedKeys       = Object.keys(headersMap).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headersMap[k]}`).join("\n") + "\n";
  const signedHeaders    = sortedKeys.join(";");

  const canonicalRequest = [method, path, queryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope  = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign     = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hash(canonicalRequest)}`;
  const signingKey       = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature        = hmac(signingKey, stringToSign, "hex");
  const authHeader       = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${path}${queryString ? "?" + queryString : ""}`;
  const fetchHeaders = { "Host": host, "X-Amz-Date": amzDate, "Authorization": authHeader };
  if (contentType) fetchHeaders["Content-Type"] = contentType;
  if (target)      fetchHeaders["X-Amz-Target"]  = target;

  return fetch(url, { method, headers: fetchHeaders, body: body || undefined });
}

export default {
  schema: {
    name: "aws_list_eks_clusters",
    description: "List EKS clusters in an AWS region with their Kubernetes version, status, and endpoint",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "string", description: "AWS region override (defaults to AWS_REGION env var)" }
      },
      required: []
    }
  },

  async execute(input) {
    const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
      return { output: "Error: Missing AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or AWS_REGION", isError: true };
    }

    const region = input.region || AWS_REGION;

    try {
      // List all cluster names
      const listResp = await awsFetch({
        service: "eks",
        region,
        method: "GET",
        path: "/clusters",
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      });

      const listText = await listResp.text();
      if (!listResp.ok) {
        return { output: `EKS error (${listResp.status}): ${listText.slice(0, 300)}`, isError: true };
      }

      const listData = JSON.parse(listText);
      const clusterNames = listData.clusters || [];

      if (clusterNames.length === 0) {
        return { output: `No EKS clusters found in ${region}.`, isError: false };
      }

      // Fetch details for each cluster
      const details = await Promise.all(
        clusterNames.map(async name => {
          try {
            const detailResp = await awsFetch({
              service: "eks",
              region,
              method: "GET",
              path: `/clusters/${encodeURIComponent(name)}`,
              accessKeyId: AWS_ACCESS_KEY_ID,
              secretAccessKey: AWS_SECRET_ACCESS_KEY,
            });
            if (!detailResp.ok) return { name, error: `HTTP ${detailResp.status}` };
            const d = await detailResp.json();
            return d.cluster || { name };
          } catch (e) {
            return { name, error: e.message };
          }
        })
      );

      const lines = details.map(c => {
        if (c.error) return `${c.name} — error fetching details: ${c.error}`;
        const version  = c.version || "unknown";
        const status   = c.status  || "unknown";
        const endpoint = c.endpoint ? c.endpoint.replace("https://", "") : "no endpoint";
        return `${c.name} — k8s version: ${version}, status: ${status}, endpoint: ${endpoint}`;
      });

      return { output: `EKS Clusters in ${region} (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
