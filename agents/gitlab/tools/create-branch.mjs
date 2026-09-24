export default {
  schema: {
    name: "gitlab_create_branch",
    description: "Create a new branch in a GitLab project",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        branch: { type: "string", description: "Name for the new branch" },
        ref: { type: "string", description: "Branch, tag, or commit to branch from" }
      },
      required: ["project_id", "branch", "ref"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) {
      return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    }

    const projectId = encodeURIComponent(input.project_id);

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}/repository/branches`, {
        method: "POST",
        headers: { "PRIVATE-TOKEN": GITLAB_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ branch: input.branch, ref: input.ref })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitLab API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const b = await response.json();
      return { output: `Created branch '${b.name}' from '${input.ref}'`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
