/**
 * Get detailed information about a specific Jira issue
 */

export default {
  schema: {
    name: "jira_get_issue",
    description: "Get detailed information about a specific Jira issue by its key (e.g., PROJ-123). Returns full details including description, comments, status, assignee, labels, etc.",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
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

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
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
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const issue = await response.json();
      const fields = issue.fields || {};

      const lines = [
        `[${issue.key}] ${fields.summary || "No summary"}`,
        "",
        `Type: ${fields.issuetype?.name || "Unknown"}`,
        `Status: ${fields.status?.name || "Unknown"}`,
        `Priority: ${fields.priority?.name || "None"}`,
        `Assignee: ${fields.assignee?.displayName || "Unassigned"}`,
        `Reporter: ${fields.reporter?.displayName || "Unknown"}`,
        `Created: ${fields.created ? new Date(fields.created).toLocaleString() : "Unknown"}`,
        `Updated: ${fields.updated ? new Date(fields.updated).toLocaleString() : "Unknown"}`,
      ];

      if (fields.labels && fields.labels.length > 0) {
        lines.push(`Labels: ${fields.labels.join(", ")}`);
      }

      if (fields.description) {
        // Extract plain text from Atlassian Document Format (ADF)
        let description = "";
        if (typeof fields.description === "object" && fields.description.content) {
          // Simple ADF parser - extract text from paragraphs
          for (const block of fields.description.content) {
            if (block.type === "paragraph" && block.content) {
              for (const inline of block.content) {
                if (inline.type === "text") {
                  description += inline.text;
                }
              }
              description += "\n";
            }
          }
        } else if (typeof fields.description === "string") {
          description = fields.description;
        }

        if (description) {
          lines.push("");
          lines.push("Description:");
          lines.push(description.trim());
        }
      }

      // Get comments if available
      if (fields.comment?.comments && fields.comment.comments.length > 0) {
        lines.push("");
        lines.push(`Comments (${fields.comment.comments.length}):`);
        for (const comment of fields.comment.comments.slice(0, 5)) {
          const author = comment.author?.displayName || "Unknown";
          const created = comment.created ? new Date(comment.created).toLocaleString() : "";

          // Extract text from comment body (ADF)
          let bodyText = "";
          if (comment.body?.content) {
            for (const block of comment.body.content) {
              if (block.type === "paragraph" && block.content) {
                for (const inline of block.content) {
                  if (inline.type === "text") {
                    bodyText += inline.text;
                  }
                }
                bodyText += "\n";
              }
            }
          }

          lines.push(`  • ${author} (${created}):`);
          lines.push(`    ${bodyText.trim()}`);
        }

        if (fields.comment.comments.length > 5) {
          lines.push(`  ... and ${fields.comment.comments.length - 5} more comments`);
        }
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return {
        output: `Error retrieving issue: ${error.message}`,
        isError: true,
      };
    }
  },
};
