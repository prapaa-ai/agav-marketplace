/**
 * Search for Jira users by name or email
 */

export default {
  schema: {
    name: "jira_search_users",
    description: "Search for Jira users by name or email address. Useful for finding account IDs needed to assign issues.",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Name or email address to search for",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
          default: 10,
        },
      },
      required: ["query"],
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

    const query = input.query;
    const maxResults = input.max_results || 10;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      const url = `${JIRA_URL}/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          output: `Jira API error (${response.status}): ${errorText}`,
          isError: true,
        };
      }

      const users = await response.json();

      if (!Array.isArray(users) || users.length === 0) {
        return {
          output: `No users found matching '${query}'.`,
          isError: false,
        };
      }

      const lines = [`Found ${users.length} user(s) matching '${query}':\n`];

      for (const user of users) {
        const displayName = user.displayName || "Unknown";
        const email = user.emailAddress || "no email";
        const accountId = user.accountId || "unknown";
        const active = user.active === false ? " [inactive]" : "";
        lines.push(`${displayName} <${email}>${active} (accountId: ${accountId})`);
      }

      return { output: lines.join("\n"), isError: false };
    } catch (error) {
      return {
        output: `Error searching users: ${error.message}`,
        isError: true,
      };
    }
  },
};
