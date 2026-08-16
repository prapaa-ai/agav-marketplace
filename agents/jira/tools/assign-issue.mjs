/**
 * Assign or unassign a Jira issue
 */

export default {
  schema: {
    name: "jira_assign_issue",
    description: "Assign a Jira issue to a user by account ID, or unassign it. Use jira_search_users to find a user's account ID.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
        },
        account_id: {
          type: "string",
          description: "The account ID of the user to assign. If omitted or empty, the issue will be unassigned.",
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
    const accountId = input.account_id || null;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}/assignee`;
      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        if (response.status === 400) {
          return {
            output: `Invalid account ID '${accountId}'. Use jira_search_users to find a valid account ID.`,
            isError: true,
          };
        }
        const errorText = await response.text();
        return {
          output: `Failed to update assignee on [${issueKey}] (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const message = accountId
        ? `Assigned [${issueKey}] to accountId: ${accountId}`
        : `Unassigned [${issueKey}] (no assignee)`;

      return { output: message, isError: false };
    } catch (error) {
      return {
        output: `Error assigning issue: ${error.message}`,
        isError: true,
      };
    }
  },
};
