/**
 * Get all comments on a specific Jira issue
 */

export default {
  schema: {
    name: "jira_get_issue_comments",
    description: "Get all comments on a specific Jira issue. Returns each comment with author, date, and body text.",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
        },
        max_results: {
          type: "number",
          description: "Maximum number of comments to return (default: 20)",
          default: 20,
        },
      },
      required: ["issue_key"],
    },
  },
  async execute(input) {
    const { JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

    if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      return {
        output: "Error: Missing Jira credentials. Please configure JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN.",
        isError: true,
      };
    }

    const issueKey = input.issue_key;
    const maxResults = input.max_results || 20;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}/comment?maxResults=${maxResults}&orderBy=created`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        const errorText = await response.text();
        return {
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const data = await response.json();
      const comments = data.comments || [];
      const total = data.total || comments.length;

      if (comments.length === 0) {
        return {
          output: `No comments on [${issueKey}].`,
          isError: false,
        };
      }

      const lines = [`[${issueKey}] — ${total} comment(s)${total > comments.length ? ` (showing first ${comments.length})` : ""}:\n`];

      for (const comment of comments) {
        const author = comment.author?.displayName || "Unknown";
        const created = comment.created ? new Date(comment.created).toLocaleString() : "Unknown date";
        const bodyText = extractAdfText(comment.body).trim() || "(no text content)";

        lines.push(`${author} (${created}):`);
        lines.push(bodyText);
        lines.push("");
      }

      return { output: lines.join("\n").trimEnd(), isError: false };
    } catch (error) {
      return {
        output: `Error retrieving comments: ${error.message}`,
        isError: true,
      };
    }
  },
};

function extractAdfText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (Array.isArray(node.content)) {
    const parts = node.content.map(extractAdfText).join("");
    const blockTypes = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock"]);
    return blockTypes.has(node.type) ? parts + "\n" : parts;
  }
  return "";
}
