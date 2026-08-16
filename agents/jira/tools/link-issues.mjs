/**
 * Create a link between two Jira issues
 */

export default {
  schema: {
    name: "jira_link_issues",
    description: "Create a directional link between two Jira issues. Common link types: 'blocks', 'is blocked by', 'clones', 'is cloned by', 'duplicates', 'relates to'.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        link_type: {
          type: "string",
          description: "The link type name (e.g., 'blocks', 'is blocked by', 'duplicates', 'relates to')",
        },
        inward_issue_key: {
          type: "string",
          description: "The key of the inward issue (e.g., PROJ-100)",
        },
        outward_issue_key: {
          type: "string",
          description: "The key of the outward issue (e.g., PROJ-200)",
        },
      },
      required: ["link_type", "inward_issue_key", "outward_issue_key"],
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

    const linkType = input.link_type;
    const inwardKey = input.inward_issue_key;
    const outwardKey = input.outward_issue_key;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/issueLink`;
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: { name: linkType },
          inwardIssue: { key: inwardKey },
          outwardIssue: { key: outwardKey },
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `One or both issues not found: [${inwardKey}], [${outwardKey}].`,
            isError: true,
          };
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => null);
          const errorMsg = errorData?.errors
            ? Object.entries(errorData.errors).map(([f, m]) => `${f}: ${m}`).join(", ")
            : errorData?.errorMessages?.join(", ") || `Link type '${linkType}' may be invalid.`;
          return {
            output: `Failed to link issues: ${errorMsg}`,
            isError: true,
          };
        }
        const errorText = await response.text();
        return {
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      return {
        output: `Linked [${inwardKey}] → "${linkType}" → [${outwardKey}]`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error linking issues: ${error.message}`,
        isError: true,
      };
    }
  },
};
