export default {
  schema: {
    name: "gitlab_get_merge_request",
    description: "Get details of a specific merge request including description and changes",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        mr_iid: { type: "number", description: "Merge request internal ID (the !N number)" }
      },
      required: ["project_id", "mr_iid"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) {
      return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    }

    const projectId = encodeURIComponent(input.project_id);

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}/merge_requests/${input.mr_iid}`, {
        headers: { "PRIVATE-TOKEN": GITLAB_TOKEN }
      });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const mr = await response.json();

      const lines = [
        `!${mr.iid} ${mr.title}`,
        `State: ${mr.state} | ${mr.source_branch} → ${mr.target_branch}`,
        `Author: ${mr.author.name} | Created: ${new Date(mr.created_at).toLocaleDateString()}`,
        ``,
        mr.description || "(No description)",
        ``,
        `Changes: +${mr.changes_count || "?"} files | Commits: ${mr.commits_count || "?"}`,
        `${mr.web_url}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
