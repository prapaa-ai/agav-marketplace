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

function xmlValue(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return m ? m[1] : "";
}

function xmlAll(xml, tag) {
  const items = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

function getNameTag(block) {
  const tagSetMatch = block.match(/<tagSet[^>]*>([\s\S]*?)<\/tagSet>/);
  if (!tagSetMatch) return "";
  const tagItems = xmlAll(tagSetMatch[1], "item");
  for (const item of tagItems) {
    if (xmlValue(item, "key") === "Name") return xmlValue(item, "value");
  }
  return "";
}

function parseInstanceBlocks(xml) {
  const instanceSets = xmlAll(xml, "instancesSet");
  const instances = [];
  for (const set of instanceSets) {
    const items = xmlAll(set, "item");
    instances.push(...items);
  }
  return instances;
}

export default {
  schema: {
    name: "aws_list_ec2_instances",
    description: "List EC2 instances in an AWS region with their state, type, and IP addresses",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "string", description: "AWS region override (defaults to AWS_REGION env var)" },
        state:  { type: "string", description: "Filter by instance state: running, stopped, pending, terminated, etc." }
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
      let body = "Action=DescribeInstances&Version=2016-11-15";
      if (input.state) {
        body += `&Filter.1.Name=instance-state-name&Filter.1.Value.1=${encodeURIComponent(input.state)}`;
      }

      const response = await awsFetch({
        service: "ec2",
        region,
        method: "POST",
        body,
        contentType: "application/x-www-form-urlencoded",
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      });

      const text = await response.text();
      if (!response.ok) {
        return { output: `EC2 error (${response.status}): ${text.slice(0, 300)}`, isError: true };
      }

      const instanceBlocks = parseInstanceBlocks(text);

      if (instanceBlocks.length === 0) {
        const stateMsg = input.state ? ` with state "${input.state}"` : "";
        return { output: `No EC2 instances found in ${region}${stateMsg}.`, isError: false };
      }

      const lines = instanceBlocks.map(b => {
        const id          = xmlValue(b, "instanceId");
        const type        = xmlValue(b, "instanceType");
        const stateMatch  = b.match(/<instanceState[^>]*>([\s\S]*?)<\/instanceState>/);
        const state       = stateMatch ? xmlValue(stateMatch[1], "name") : "unknown";
        const publicIp    = xmlValue(b, "publicIpAddress");
        const privateIp   = xmlValue(b, "privateIpAddress");
        const name        = getNameTag(b);
        const ip          = publicIp || privateIp || "no IP";
        const namePart    = name ? `, name: ${name}` : "";
        return `${id} (${type}) — state: ${state}${namePart}, IP: ${ip}`;
      });

      return { output: `EC2 Instances in ${region} (${lines.length}):\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
