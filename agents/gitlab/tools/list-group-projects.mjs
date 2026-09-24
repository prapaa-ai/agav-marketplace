export default {
  schema: {
    name: "gitlab_list_group_projects",
    description: "List projects belonging to a GitLab group",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Group ID (numeric) or full path (e.g. 'my-org/my-group')" },
        per_page: { type: "number", description: "Number of results to return (defaults to 30)", default: 30 }
      },
      required: ["group_id"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const groupId = encodeURIComponent(input.group_id);
    const params = new URLSearchParams({
      per_page: String(input.per_page || 30),
      order_by: "last_activity_at"
    });

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/groups/${groupId}/projects?${params}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const projects = await response.json();
      if (!projects.length) return { output: "No projects found in this group.", isError: false };

      const lines = [`Found ${projects.length} project(s) in group '${input.group_id}':\n`];
      for (const p of projects) {
        lines.push(`[${p.id}] ${p.name} — ${p.description || "(no description)"} (${p.web_url})`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
