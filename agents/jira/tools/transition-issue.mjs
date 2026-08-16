/**
 * Transition a Jira issue to a new workflow status
 */

export default {
  schema: {
    name: "jira_transition_issue",
    description: "Move a Jira issue to a new workflow status using a transition ID. Use jira_get_available_transitions first to find valid transition IDs for the issue.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
        },
        transition_id: {
          type: "string",
          description: "The transition ID to apply. Use jira_get_available_transitions to find valid IDs.",
        },
      },
      required: ["issue_key", "transition_id"],
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
    const transitionId = input.transition_id;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/issue/${issueKey}/transitions`;
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ transition: { id: transitionId } }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => null);
          const errorMsg = errorData?.errorMessages?.join(", ") || `Transition ID '${transitionId}' may be invalid for this issue.`;
          return {
            output: `Failed to transition [${issueKey}]: ${errorMsg}`,
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
        output: `Transitioned [${issueKey}] using transition ID ${transitionId} successfully.`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error transitioning issue: ${error.message}`,
        isError: true,
      };
    }
  },
};
