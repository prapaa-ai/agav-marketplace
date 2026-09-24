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
    name: "aws_get_month_to_date_cost",
    description: "Get the current month-to-date AWS total cost using Cost Explorer",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  async execute(_input) {
    const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return { output: "Error: Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY", isError: true };
    }

    try {
      const today = new Date();
      const year  = today.getUTCFullYear();
      const month = String(today.getUTCMonth() + 1).padStart(2, "0");
      const day   = String(today.getUTCDate()).padStart(2, "0");

      const start = `${year}-${month}-01`;
      // Cost Explorer end date is exclusive — use tomorrow so today is included
      const endDate  = new Date(today);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const endYear  = endDate.getUTCFullYear();
      const endMonth = String(endDate.getUTCMonth() + 1).padStart(2, "0");
      const endDay   = String(endDate.getUTCDate()).padStart(2, "0");
      const end      = `${endYear}-${endMonth}-${endDay}`;

      const payload = JSON.stringify({
        TimePeriod: { Start: start, End: end },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
      });

      const response = await awsFetch({
        service: "ce",
        region: "us-east-1",
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
        return { output: "No cost data available for the current month.", isError: false };
      }

      const total = results[0]?.Total?.UnblendedCost;
      const amount = total ? parseFloat(total.Amount).toFixed(2) : "0.00";
      const unit   = total?.Unit || "USD";

      return {
        output: `Month-to-date cost: $${amount} ${unit} (from ${start} to ${`${year}-${month}-${day}`})`,
        isError: false,
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
