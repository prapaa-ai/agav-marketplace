/**
 * Add a comment to a Jira issue
 */

export default {
  schema: {
    name: "jira_add_comment",
    description: "Add a comment to a Jira issue. Can mention users using @email or @displayName.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
        },
        comment_body: {
          type: "string",
          description: "The comment text to add",
        },
      },
      required: ["issue_key", "comment_body"],
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
    const commentBody = input.comment_body;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

      // Build comment in ADF format
      const body = {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: commentBody,
              },
            ],
          },
        ],
      };

      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}/comment`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        const errorText = await response.text();
        return {
          output: `Failed to add comment (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const result = await response.json();
      const commentUrl = `${JIRA_URL}/browse/${issueKey}?focusedCommentId=${result.id}`;

      return {
        output: `Successfully added comment to [${issueKey}]\nURL: ${commentUrl}`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error adding comment: ${error.message}`,
        isError: true,
      };
    }
  },
};
