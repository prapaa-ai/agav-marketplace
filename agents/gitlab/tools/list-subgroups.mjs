export default {
  schema: {
    name: "gitlab_list_subgroups",
    description: "List subgroups of a GitLab group",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string", description: "Parent group ID (numeric) or full path" }
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
      const response = await fetch(
        `${GITLAB_URL}/api/v4/groups/${groupId}/subgroups?per_page=30`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const subgroups = await response.json();
      if (!subgroups.length) return { output: "No subgroups found.", isError: false };

      const lines = [`Found ${subgroups.length} subgroup(s) under '${input.group_id}':\n`];
      for (const g of subgroups) {
        lines.push(`[${g.id}] ${g.name} (${g.full_path}) — ${g.description || "(no description)"}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
