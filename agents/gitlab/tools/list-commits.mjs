export default {
  schema: {
    name: "gitlab_list_commits",
    description: "List recent commits for a GitLab project branch",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        branch: { type: "string", description: "Branch name (defaults to 'main')", default: "main" },
        per_page: { type: "number", description: "Number of commits to return (defaults to 20)", default: 20 }
      },
      required: ["project_id"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const projectId = encodeURIComponent(input.project_id);
    const branch = input.branch || "main";
    const perPage = input.per_page || 20;

    const params = new URLSearchParams({ ref_name: branch, per_page: String(perPage) });

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/repository/commits?${params}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const commits = await response.json();
      if (!commits.length) return { output: "No commits found.", isError: false };

      const lines = [`Found ${commits.length} commit(s) on '${branch}':\n`];
      for (const c of commits) {
        const date = new Date(c.created_at).toLocaleDateString();
        lines.push(`• ${c.short_id}  ${c.author_name}: ${c.title} (${date})`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
