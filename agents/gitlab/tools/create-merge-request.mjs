export default {
  schema: {
    name: "gitlab_create_merge_request",
    description: "Create a new merge request in a GitLab project",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        source_branch: { type: "string", description: "Branch to merge from" },
        target_branch: { type: "string", description: "Branch to merge into" },
        title: { type: "string", description: "Merge request title" },
        description: { type: "string", description: "Merge request description" }
      },
      required: ["project_id", "source_branch", "target_branch", "title"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) {
      return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    }

    const projectId = encodeURIComponent(input.project_id);

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}/merge_requests`, {
        method: "POST",
        headers: { "PRIVATE-TOKEN": GITLAB_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({
          source_branch: input.source_branch,
          target_branch: input.target_branch,
          title: input.title,
          description: input.description || ""
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitLab API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const mr = await response.json();
      return { output: `Created MR !${mr.iid}: ${mr.title}\n${mr.web_url}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
