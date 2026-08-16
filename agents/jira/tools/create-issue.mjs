/**
 * Create a new Jira issue
 */

export default {
  schema: {
    name: "jira_create_issue",
    description: "Create a new Jira issue in a specific project. Returns the created issue key.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        project_key: {
          type: "string",
          description: "The project key (e.g., 'PROJ')",
        },
        summary: {
          type: "string",
          description: "Issue title/summary",
        },
        issue_type: {
          type: "string",
          description: "Issue type (e.g., 'Bug', 'Story', 'Task')",
          default: "Task",
        },
        description: {
          type: "string",
          description: "Issue description (optional)",
        },
        priority: {
          type: "string",
          description: "Priority name (e.g., 'High', 'Medium', 'Low')",
        },
        assignee: {
          type: "string",
          description: "Assignee email or account ID (optional)",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Array of label strings (optional)",
        },
      },
      required: ["project_key", "summary"],
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

    const projectKey = input.project_key;
    const summary = input.summary;
    const issueType = input.issue_type || "Task";
    const description = input.description || "";
    const priority = input.priority;
    const assignee = input.assignee;
    const labels = input.labels || [];

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

      // Build issue fields
      const fields = {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueType },
      };

      // Add description (convert to ADF format)
      if (description) {
        fields.description = {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description,
                },
              ],
            },
          ],
        };
      }

      // Add priority
      if (priority) {
        fields.priority = { name: priority };
      }

      // Add assignee
      if (assignee) {
        // Try as account ID first, then as email
        if (assignee.includes("@")) {
          // Search for user by email
          const searchUrl = `${JIRA_URL}/rest/api/3/user/search?query=${encodeURIComponent(assignee)}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              Authorization: `Basic ${auth}`,
              Accept: "application/json",
            },
          });

          if (searchResponse.ok) {
            const users = await searchResponse.json();
            if (users.length > 0) {
              fields.assignee = { accountId: users[0].accountId };
            }
          }
        } else {
          fields.assignee = { accountId: assignee };
        }
      }

      // Add labels
      if (labels.length > 0) {
        fields.labels = labels;
      }

      // Create the issue
      const createUrl = `${JIRA_URL}/rest/api/3/issue`;
      const response = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessages = errorData.errors
          ? Object.entries(errorData.errors)
              .map(([field, msg]) => `${field}: ${msg}`)
              .join(", ")
          : errorData.errorMessages?.join(", ") || "Unknown error";

        return {
          output: `Failed to create issue: ${errorMessages}`,
          isError: true,
        };
      }

      const result = await response.json();
      const issueKey = result.key;
      const issueUrl = `${JIRA_URL}/browse/${issueKey}`;

      return {
        output: `Successfully created issue [${issueKey}]: ${summary}\nURL: ${issueUrl}`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error creating issue: ${error.message}`,
        isError: true,
      };
    }
  },
};
