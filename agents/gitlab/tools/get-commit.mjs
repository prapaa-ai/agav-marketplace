export default {
  schema: {
    name: "gitlab_get_commit",
    description: "Get details of a specific commit including stats",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        sha: { type: "string", description: "Full or short commit SHA" }
      },
      required: ["project_id", "sha"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const projectId = encodeURIComponent(input.project_id);

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/repository/commits/${input.sha}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const c = await response.json();

      const stats = c.stats
        ? `+${c.stats.additions} / -${c.stats.deletions} (${c.stats.total} changes)`
        : "(stats unavailable)";

      const lines = [
        `Commit: ${c.id}`,
        `Author: ${c.author_name} <${c.author_email}>`,
        `Date: ${new Date(c.created_at).toLocaleString()}`,
        ``,
        `${c.title}`,
        ...(c.message && c.message !== c.title ? [``, c.message.trim()] : []),
        ``,
        `Stats: ${stats}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
