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

function xmlAll(xml, tag) {
  const items = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

function xmlValue(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return m ? m[1] : "";
}

export default {
  schema: {
    name: "aws_list_s3_buckets",
    description: "List all S3 buckets in the AWS account with their creation dates",
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
      // S3 global endpoint — always signed with us-east-1 but host is s3.amazonaws.com
      const response = await awsFetch({
        service: "s3",
        region: "us-east-1",
        method: "GET",
        path: "/",
        customHost: "s3.amazonaws.com",
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      });

      const text = await response.text();
      if (!response.ok) {
        return { output: `S3 error (${response.status}): ${text.slice(0, 300)}`, isError: true };
      }

      const buckets = xmlAll(text, "Bucket");
      if (buckets.length === 0) {
        return { output: "No S3 buckets found in this account.", isError: false };
      }

      const lines = buckets.map(b => {
        const name    = xmlValue(b, "Name");
        const created = xmlValue(b, "CreationDate");
        return `${name} (created: ${created})`;
      });

      return { output: `S3 Buckets (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
