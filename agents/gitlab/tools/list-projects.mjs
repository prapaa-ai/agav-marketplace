export default {
  schema: {
    name: "gitlab_list_projects",
    description: "List GitLab projects accessible to the authenticated user",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Filter projects by name" },
        membership: { type: "boolean", description: "Only return projects the user is a member of", default: true },
        max_results: { type: "number", description: "Maximum results to return", default: 20 }
      }
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) {
      return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    }

    const params = new URLSearchParams({
      membership: String(input.membership ?? true),
      per_page: String(input.max_results || 20),
      order_by: "last_activity_at",
    });
    if (input.search) params.set("search", input.search);

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/projects?${params}`, {
        headers: { "PRIVATE-TOKEN": GITLAB_TOKEN }
      });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const projects = await response.json();
      if (!projects.length) return { output: "No projects found.", isError: false };

      const lines = [`Found ${projects.length} project(s):\n`];
      for (const p of projects) {
        lines.push(`• ${p.path_with_namespace} (ID: ${p.id})\n  ${p.description || "No description"}\n  ${p.web_url}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
