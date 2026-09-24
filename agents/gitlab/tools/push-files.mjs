export default {
  schema: {
    name: "gitlab_push_files",
    description: "Push multiple file changes to a GitLab repository in a single commit",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        branch: { type: "string", description: "Target branch name" },
        commit_message: { type: "string", description: "Commit message" },
        files: {
          type: "array",
          description: "Files to push",
          items: {
            type: "object",
            properties: {
              action: { type: "string", description: "One of: create, update, delete" },
              file_path: { type: "string", description: "Path to the file within the repository" },
              content: { type: "string", description: "File content (required for create/update)" }
            },
            required: ["action", "file_path"]
          }
        }
      },
      required: ["project_id", "branch", "commit_message", "files"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json", "Content-Type": "application/json" };

    const projectId = encodeURIComponent(input.project_id);

    const actions = input.files.map(f => ({
      action: f.action,
      file_path: f.file_path,
      ...(f.content !== undefined ? { content: f.content } : {})
    }));

    const body = JSON.stringify({
      branch: input.branch,
      commit_message: input.commit_message,
      actions
    });

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/repository/commits`,
        { method: "POST", headers, body }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitLab API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const commit = await response.json();
      return {
        output: `Pushed ${input.files.length} file(s) to branch ${input.branch}: commit ${commit.short_id}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
