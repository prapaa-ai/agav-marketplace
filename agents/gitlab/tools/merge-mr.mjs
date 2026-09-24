export default {
  schema: {
    name: "gitlab_merge_mr",
    description: "Merge an open merge request",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        mr_iid: { type: "number", description: "Merge request internal ID (the !N number)" },
        remove_source_branch: { type: "boolean", description: "Delete source branch after merge (defaults to false)", default: false }
      },
      required: ["project_id", "mr_iid"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json", "Content-Type": "application/json" };

    const projectId = encodeURIComponent(input.project_id);

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/merge_requests/${input.mr_iid}/merge`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ should_remove_source_branch: input.remove_source_branch ?? false })
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitLab API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      return { output: `Merged MR !${input.mr_iid}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
