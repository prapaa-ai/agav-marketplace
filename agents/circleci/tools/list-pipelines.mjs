export default {
  schema: {
    name: "circleci_list_pipelines",
    description: "List recent pipelines for a CircleCI project",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project_slug: { type: "string", description: "Project slug e.g. 'gh/org-name/repo-name'" },
        branch: { type: "string", description: "Filter by branch name (optional)" },
        limit: { type: "number", description: "Number of pipelines to return (default: 10)" }
      },
      required: ["project_slug"]
    }
  },
  async execute(input) {
    const { CIRCLECI_TOKEN } = process.env;
    if (!CIRCLECI_TOKEN) return { output: "Error: Missing CIRCLECI_TOKEN", isError: true };

    const limit = Math.min(Math.max(input.limit || 10, 1), 50);
    let url = `https://circleci.com/api/v2/project/${input.project_slug}/pipeline?page-token=&`;
    if (input.branch) url += `branch=${encodeURIComponent(input.branch)}&`;

    try {
      const response = await fetch(url, {
        headers: { "Circle-Token": CIRCLECI_TOKEN }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `CircleCI API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const data = await response.json();
      const pipelines = (data.items || []).slice(0, limit);

      if (!pipelines.length) return { output: "No pipelines found.", isError: false };

      const lines = pipelines.map(p => {
        const branch = p.vcs?.branch || "n/a";
        return `#${p.number} | ${p.state} | branch: ${branch} | trigger: ${p.trigger?.type || "unknown"} | ${p.created_at}`;
      });

      return { output: `Pipelines for ${input.project_slug}:\n\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
