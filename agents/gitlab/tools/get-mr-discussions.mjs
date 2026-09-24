export default {
  schema: {
    name: "gitlab_get_mr_discussions",
    description: "Get discussion threads and comments on a merge request",
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
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const projectId = encodeURIComponent(input.project_id);

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/merge_requests/${input.mr_iid}/discussions?per_page=20`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const discussions = await response.json();

      const notes = [];
      for (const discussion of discussions) {
        for (const note of discussion.notes || []) {
          if (note.system) continue;
          const date = new Date(note.created_at).toLocaleString();
          notes.push(`${note.author.name} (${date}):\n  ${note.body}`);
        }
      }

      if (!notes.length) return { output: "No discussion notes found.", isError: false };
      return { output: `${notes.length} note(s) on MR !${input.mr_iid}:\n\n${notes.join("\n\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
