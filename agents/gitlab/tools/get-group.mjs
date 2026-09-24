export default {
  schema: {
    name: "gitlab_get_group",
    description: "Get details of a GitLab group by ID or full path",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Group ID (numeric) or full path (e.g. 'my-org/my-group')" }
      },
      required: ["group_id"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const groupId = encodeURIComponent(input.group_id);

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/groups/${groupId}`, { headers });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const g = await response.json();

      const lines = [
        `${g.name} (ID: ${g.id})`,
        `Path: ${g.full_path}`,
        `Description: ${g.description || "(none)"}`,
        `Visibility: ${g.visibility}`,
        ...(g.parent_id != null ? [`Parent ID: ${g.parent_id}`] : []),
        `URL: ${g.web_url}`
      ];

      if (g.statistics) {
        const s = g.statistics;
        lines.push(`Storage: ${(s.storage_size / 1024 / 1024).toFixed(1)} MB`);
      }

      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
