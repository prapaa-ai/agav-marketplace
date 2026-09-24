export default {
  schema: {
    name: "gitlab_list_branches",
    description: "List branches for a GitLab project",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        search: { type: "string", description: "Filter branches by name" },
        max_results: { type: "number", description: "Maximum results to return", default: 20 }
      },
      required: ["project_id"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) {
      return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    }

    const projectId = encodeURIComponent(input.project_id);
    const params = new URLSearchParams({ per_page: String(input.max_results || 20) });
    if (input.search) params.set("search", input.search);

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}/repository/branches?${params}`, {
        headers: { "PRIVATE-TOKEN": GITLAB_TOKEN }
      });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const branches = await response.json();
      if (!branches.length) return { output: "No branches found.", isError: false };

      const lines = [`Found ${branches.length} branch(es):\n`];
      for (const b of branches) {
        const defaultMark = b.default ? " [default]" : "";
        lines.push(`• ${b.name}${defaultMark} — ${b.commit.short_id} ${b.commit.title}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
