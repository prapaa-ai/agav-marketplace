/**
 * Remove specific labels from a Jira issue
 */

export default {
  schema: {
    name: "jira_remove_labels",
    description: "Remove one or more labels from a Jira issue. Other existing labels are preserved.",
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
          description: "Labels to remove from the issue",
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
    const labelsToRemove = input.labels;

    if (!labelsToRemove || labelsToRemove.length === 0) {
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

      const removeSet = new Set(labelsToRemove);
      const remainingLabels = existingLabels.filter((l) => !removeSet.has(l));

      // Report labels that were not present
      const notFound = labelsToRemove.filter((l) => !existingLabels.includes(l));

      // PUT updated labels
      const putUrl = `${JIRA_URL}/rest/api/3/issue/${issueKey}`;
      const putResponse = await fetch(putUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({ fields: { labels: remainingLabels } }),
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

      const removedStr = labelsToRemove.filter((l) => !notFound.includes(l)).join(", ") || "(none were present)";
      const remainingStr = remainingLabels.join(", ") || "(none)";

      let output = `Removed labels [${removedStr}] from [${issueKey}]. Remaining labels: [${remainingStr}]`;
      if (notFound.length > 0) {
        output += `\nNote: these labels were not on the issue: [${notFound.join(", ")}]`;
      }

      return { output, isError: false };
    } catch (error) {
      return {
        output: `Error removing labels: ${error.message}`,
        isError: true,
      };
    }
  },
};
