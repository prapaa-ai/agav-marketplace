export default {
  schema: {
    name: "gitlab_get_file_contents",
    description: "Get the contents of a file from a GitLab repository",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        file_path: { type: "string", description: "Path to the file within the repository (e.g. 'src/main.js')" },
        ref: { type: "string", description: "Branch, tag, or commit SHA (defaults to 'main')", default: "main" }
      },
      required: ["project_id", "file_path"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const projectId = encodeURIComponent(input.project_id);
    const filePath = encodeURIComponent(input.file_path);
    const ref = input.ref || "main";

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/repository/files/${filePath}?ref=${encodeURIComponent(ref)}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const MAX = 5000;
      if (content.length > MAX) {
        return {
          output: `File: ${data.file_path} (ref: ${data.ref}, size: ${data.size} bytes)\n\n${content.slice(0, MAX)}\n\n[... truncated at ${MAX} characters — file is ${content.length} chars total]`,
          isError: false
        };
      }
      return {
        output: `File: ${data.file_path} (ref: ${data.ref}, size: ${data.size} bytes)\n\n${content}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
