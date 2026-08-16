/**
 * Add labels to a Jira issue without removing existing ones
 */

export default {
  schema: {
    name: "jira_add_labels",
    description: "Add one or more labels to a Jira issue. Existing labels are preserved — only the new labels are appended.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels to add to the issue",
        },
      },
      required: ["issue_key", "labels"],
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
    const labelsToAdd = input.labels;

    if (!labelsToAdd || labelsToAdd.length === 0) {
      return {
        output: "Error: At least one label must be provided.",
        isError: true,
      };
    }

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      // GET current issue to read existing labels
      const getUrl = `${JIRA_URL}/rest/api/3/issue/${issueKey}?fields=labels`;
      const getResponse = await fetch(getUrl, { headers });

      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        const errorText = await getResponse.text();
        return {
          output: `Jira API error fetching issue (${getResponse.status}): ${errorText}`,
          isError: true,
        };
      }

      const issueData = await getResponse.json();
      const existingLabels = issueData.fields?.labels || [];

      // Merge: existing + new, deduplicated
      const mergedLabels = [...new Set([...existingLabels, ...labelsToAdd])];

      // PUT updated labels
      const putUrl = `${JIRA_URL}/rest/api/3/issue/${issueKey}`;
      const putResponse = await fetch(putUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({ fields: { labels: mergedLabels } }),
      });

      if (!putResponse.ok) {
        const errorData = await putResponse.json().catch(() => null);
        const errorMsg = errorData?.errors
          ? Object.entries(errorData.errors).map(([f, m]) => `${f}: ${m}`).join(", ")
          : `HTTP ${putResponse.status}`;
        return {
          output: `Failed to update labels on [${issueKey}]: ${errorMsg}`,
          isError: true,
        };
      }

      const addedStr = labelsToAdd.join(", ");
      const allStr = mergedLabels.join(", ") || "(none)";

      return {
        output: `Added labels [${addedStr}] to [${issueKey}]. All labels: [${allStr}]`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error adding labels: ${error.message}`,
        isError: true,
      };
    }
  },
};
