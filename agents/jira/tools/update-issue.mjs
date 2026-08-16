/**
 * Update fields on an existing Jira issue
 */

export default {
  schema: {
    name: "jira_update_issue",
    description: "Update one or more fields on an existing Jira issue (summary, description, priority, or labels). At least one field must be provided.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
        },
        summary: {
          type: "string",
          description: "New issue summary/title",
        },
        description: {
          type: "string",
          description: "New issue description (plain text, will be converted to ADF)",
        },
        priority: {
          type: "string",
          description: "New priority name (e.g., 'High', 'Medium', 'Low', 'Critical')",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Replace the entire labels list with these labels",
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
    const { summary, description, priority, labels } = input;

    if (!summary && !description && !priority && !labels) {
      return {
        output: "Error: At least one field (summary, description, priority, or labels) must be provided.",
        isError: true,
      };
    }

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const fields = {};

      if (summary) {
        fields.summary = summary;
      }

      if (description) {
        fields.description = {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: description }],
            },
          ],
        };
      }

      if (priority) {
        fields.priority = { name: priority };
      }

      if (labels) {
        fields.labels = labels;
      }

      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}`;
      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.errors
          ? Object.entries(errorData.errors).map(([f, m]) => `${f}: ${m}`).join(", ")
          : errorData?.errorMessages?.join(", ") || `HTTP ${response.status}`;
        return {
          output: `Failed to update [${issueKey}]: ${errorMsg}`,
          isError: true,
        };
      }

      const updated = [];
      if (summary) updated.push(`summary: "${summary}"`);
      if (description) updated.push("description");
      if (priority) updated.push(`priority: ${priority}`);
      if (labels) updated.push(`labels: [${labels.join(", ")}]`);

      return {
        output: `Updated [${issueKey}] successfully.\nChanged: ${updated.join(", ")}`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error updating issue: ${error.message}`,
        isError: true,
      };
    }
  },
};
