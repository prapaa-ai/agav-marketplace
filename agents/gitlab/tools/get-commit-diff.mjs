export default {
  schema: {
    name: "gitlab_get_commit_diff",
    description: "Get the diff for a specific commit showing file changes",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. 'group/project')" },
        sha: { type: "string", description: "Full or short commit SHA" }
      },
      required: ["project_id", "sha"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const projectId = encodeURIComponent(input.project_id);

    try {
      const response = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}/repository/commits/${input.sha}/diff`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const diffs = await response.json();
      if (!diffs.length) return { output: "No diff found for this commit.", isError: false };

      const MAX = 3000;
      const parts = [];
      for (const d of diffs) {
        parts.push(`--- ${d.old_path}\n+++ ${d.new_path}\n${d.diff || ""}`);
      }
      const full = parts.join("\n\n");
      if (full.length > MAX) {
        return {
          output: `${full.slice(0, MAX)}\n\n[... diff truncated at ${MAX} characters]`,
          isError: false
        };
      }
      return { output: full, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
