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
    name: "aws_get_cost_summary",
    description: "Get AWS cost summary for a date range, grouped by SERVICE, ACCOUNT, or REGION using Cost Explorer",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Start date in YYYY-MM-DD format (inclusive)" },
        end_date:   { type: "string", description: "End date in YYYY-MM-DD format (exclusive)" },
        group_by:   { type: "string", description: "Dimension to group by: SERVICE, LINKED_ACCOUNT, or REGION (default: SERVICE)" }
      },
      required: ["start_date", "end_date"]
    }
  },

  async execute(input) {
    const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return { output: "Error: Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY", isError: true };
    }

    const { start_date, end_date, group_by = "SERVICE" } = input;

    try {
      const payload = JSON.stringify({
        TimePeriod: { Start: start_date, End: end_date },
        Granularity: "MONTHLY",
        GroupBy: [{ Type: "DIMENSION", Key: group_by }],
        Metrics: ["UnblendedCost"],
      });

      const response = await awsFetch({
        service: "ce",
        region: "us-east-1",   // Cost Explorer only available in us-east-1
        method: "POST",
        path: "/",
        body: payload,
        contentType: "application/x-amz-json-1.1",
        target: "AmazonCostExplorer.GetCostAndUsage",
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      });

      const text = await response.text();
      if (!response.ok) {
        return { output: `Cost Explorer error (${response.status}): ${text.slice(0, 300)}`, isError: true };
      }

      const data = JSON.parse(text);
      const results = data.ResultsByTime || [];

      if (results.length === 0) {
        return { output: "No cost data found for the specified period.", isError: false };
      }

      const costMap = {};
      for (const period of results) {
        for (const group of period.Groups || []) {
          const key    = group.Keys.join(" / ");
          const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
          const unit   = group.Metrics?.UnblendedCost?.Unit || "USD";
          costMap[key] = (costMap[key] || 0) + amount;
          if (!costMap.__unit) costMap.__unit = unit;
        }
      }

      const unit = costMap.__unit || "USD";
      delete costMap.__unit;

      const entries = Object.entries(costMap)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `  ${k.padEnd(50)} $${v.toFixed(4)} ${unit}`);

      const total = Object.values(costMap).reduce((a, b) => a + b, 0);
      const header = `AWS Cost Summary (${start_date} to ${end_date}), grouped by ${group_by}:`;
      const footer = `${"  " + "TOTAL".padEnd(50)} $${total.toFixed(4)} ${unit}`;

      return { output: [header, ...entries, "  " + "-".repeat(60), footer].join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
