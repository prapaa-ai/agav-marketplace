export default {
  schema: {
    name: "gitlab_create_or_update_file",
    description: "Create or update a single file in a GitLab repository",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        file_path: { type: "string", description: "Path to the file within the repository" },
        content: { type: "string", description: "File content (plain text)" },
        commit_message: { type: "string", description: "Commit message" },
        branch: { type: "string", description: "Target branch (defaults to 'main')", default: "main" }
      },
      required: ["project_id", "file_path", "content", "commit_message"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json", "Content-Type": "application/json" };

    const projectId = encodeURIComponent(input.project_id);
    const filePath = encodeURIComponent(input.file_path);
    const branch = input.branch || "main";

    try {
      // Check if file already exists
      const checkResponse = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/repository/files/${filePath}?ref=${encodeURIComponent(branch)}`,
        { headers }
      );

      const method = checkResponse.ok ? "PUT" : "POST";
      const action = checkResponse.ok ? "Updated" : "Created";

      const body = JSON.stringify({
        branch,
        content: input.content,
        commit_message: input.commit_message,
        encoding: "text"
      });

      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/repository/files/${filePath}`,
        { method, headers, body }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitLab API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }

      return { output: `${action} file '${input.file_path}' on branch ${branch}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
