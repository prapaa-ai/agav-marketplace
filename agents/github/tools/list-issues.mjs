export default {
  schema: {
    name: "github_list_issues",
    description: "List issues in a GitHub repository (pull requests are excluded)",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", description: "Issue state: open, closed, or all (defaults to open)" },
        per_page: { type: "number", description: "Number of results to return (defaults to 20)" },
        labels: { type: "string", description: "Comma-separated label names to filter by (e.g. bug,help wanted)" }
      },
      required: ["owner", "repo"]
    }
  },
  async execute(input) {
    const { GITHUB_TOKEN } = process.env;
    if (!GITHUB_TOKEN) return { output: "Error: Missing GITHUB_TOKEN", isError: true };

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    const state = input.state || "open";
    const perPage = input.per_page || 20;
    const params = new URLSearchParams({ state, per_page: String(perPage), sort: "updated", direction: "desc" });
    if (input.labels) params.set("labels", input.labels);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/issues?${params}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitHub API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const all = await response.json();
      // GitHub's issues endpoint returns PRs too — filter them out
      const issues = all.filter(i => !i.pull_request);
      if (!issues.length) return { output: `No ${state} issues found.`, isError: false };

      const lines = [`Found ${issues.length} issue(s) [${state}]:\n`];
      for (const issue of issues) {
        const created = new Date(issue.created_at).toLocaleDateString();
        const labels = issue.labels.map(l => l.name).join(", ") || "none";
        lines.push(`#${issue.number} [${issue.state}] ${issue.title} — ${issue.user.login} (${created}) labels: [${labels}]`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
