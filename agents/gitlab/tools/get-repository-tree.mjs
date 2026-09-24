export default {
  schema: {
    name: "gitlab_get_repository_tree",
    description: "List files and directories in a GitLab repository at a given path",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        path: { type: "string", description: "Directory path to list (defaults to root)", default: "" },
        ref: { type: "string", description: "Branch, tag, or commit SHA (defaults to 'main')", default: "main" }
      },
      required: ["project_id"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const projectId = encodeURIComponent(input.project_id);
    const path = input.path || "";
    const ref = input.ref || "main";

    const params = new URLSearchParams({ ref, recursive: "false", per_page: "50" });
    if (path) params.set("path", path);

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/repository/tree?${params}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const entries = await response.json();
      if (!entries.length) return { output: "No entries found at this path.", isError: false };

      const location = path ? `'${path}'` : "root";
      const lines = [`Repository tree at ${location} (ref: ${ref}):\n`];
      for (const entry of entries) {
        const typeLabel = entry.type === "tree" ? "tree" : "blob";
        lines.push(`[${typeLabel}] ${entry.name}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
