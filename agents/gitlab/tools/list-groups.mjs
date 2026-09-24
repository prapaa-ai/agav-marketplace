export default {
  schema: {
    name: "gitlab_list_groups",
    description: "List GitLab groups accessible to the authenticated user",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Filter groups by name" },
        per_page: { type: "number", description: "Number of results to return (defaults to 30)", default: 30 }
      }
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const params = new URLSearchParams({
      per_page: String(input.per_page || 30),
      order_by: "name",
      sort: "asc"
    });
    if (input.search) params.set("search", input.search);

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/groups?${params}`, { headers });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const groups = await response.json();
      if (!groups.length) return { output: "No groups found.", isError: false };

      const lines = [`Found ${groups.length} group(s):\n`];
      for (const g of groups) {
        lines.push(`[${g.id}] ${g.name} — ${g.description || "(no description)"} (${g.web_url})`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
