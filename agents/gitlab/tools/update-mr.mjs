export default {
  schema: {
    name: "gitlab_update_mr",
    description: "Update fields of an existing merge request (title, description, assignee, target branch)",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        mr_iid: { type: "number", description: "Merge request internal ID (the !N number)" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        assignee_id: { type: "number", description: "User ID of the new assignee" },
        target_branch: { type: "string", description: "New target branch" }
      },
      required: ["project_id", "mr_iid"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json", "Content-Type": "application/json" };

    const projectId = encodeURIComponent(input.project_id);

    const payload = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.assignee_id !== undefined) payload.assignee_id = input.assignee_id;
    if (input.target_branch !== undefined) payload.target_branch = input.target_branch;

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/merge_requests/${input.mr_iid}`,
        { method: "PUT", headers, body: JSON.stringify(payload) }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitLab API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      return { output: `Updated MR !${input.mr_iid}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
