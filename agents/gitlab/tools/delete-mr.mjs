export default {
  schema: {
    name: "gitlab_delete_mr",
    description: "Delete a merge request (admin/maintainer only)",
    destructive: true,
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
        `${GITLAB_URL}/api/v4/projects/${projectId}/merge_requests/${input.mr_iid}`,
        { method: "DELETE", headers }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitLab API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      return { output: `Deleted MR !${input.mr_iid}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
