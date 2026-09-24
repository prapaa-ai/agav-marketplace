export default {
  schema: {
    name: "gitlab_get_project",
    description: "Get details of a GitLab project by ID or path",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project' or '123')" }
      },
      required: ["project_id"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const projectId = encodeURIComponent(input.project_id);

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}`, { headers });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const p = await response.json();

      const lines = [
        `${p.name} (ID: ${p.id})`,
        `Path: ${p.path_with_namespace}`,
        `Description: ${p.description || "(none)"}`,
        `Default branch: ${p.default_branch || "(none)"}`,
        `Visibility: ${p.visibility}`,
        `Stars: ${p.star_count} | Forks: ${p.forks_count}`,
        `Last activity: ${p.last_activity_at ? new Date(p.last_activity_at).toLocaleString() : "unknown"}`,
        `URL: ${p.web_url}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
