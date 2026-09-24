export default {
  schema: {
    name: "gitlab_list_merge_requests",
    description: "List merge requests for a GitLab project",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        state: { type: "string", description: "Filter by state: opened, closed, merged, all", default: "opened" },
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
    const params = new URLSearchParams({
      state: input.state || "opened",
      per_page: String(input.max_results || 20),
      order_by: "updated_at"
    });

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}/merge_requests?${params}`, {
        headers: { "PRIVATE-TOKEN": GITLAB_TOKEN }
      });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const mrs = await response.json();
      if (!mrs.length) return { output: "No merge requests found.", isError: false };

      const lines = [`Found ${mrs.length} merge request(s):\n`];
      for (const mr of mrs) {
        lines.push(`• !${mr.iid} [${mr.state}] ${mr.title}\n  Author: ${mr.author.name} | ${mr.source_branch} → ${mr.target_branch}\n  ${mr.web_url}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
