const ACCESS_LEVELS = {
  10: "Guest",
  20: "Reporter",
  30: "Developer",
  40: "Maintainer",
  50: "Owner"
};

export default {
  schema: {
    name: "gitlab_list_project_members",
    description: "List members of a GitLab project with their access levels",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        per_page: { type: "number", description: "Number of results to return (defaults to 30)", default: 30 }
      },
      required: ["project_id"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const projectId = encodeURIComponent(input.project_id);
    const params = new URLSearchParams({ per_page: String(input.per_page || 30) });

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/members?${params}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const members = await response.json();
      if (!members.length) return { output: "No members found.", isError: false };

      const lines = [`Found ${members.length} member(s):\n`];
      for (const m of members) {
        const level = ACCESS_LEVELS[m.access_level] || `Level ${m.access_level}`;
        lines.push(`${m.username} (${m.name}) — access level: ${level}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
