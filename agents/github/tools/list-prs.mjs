export default {
  schema: {
    name: "github_list_prs",
    description: "List pull requests in a GitHub repository",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", description: "PR state: open, closed, or all (defaults to open)" },
        per_page: { type: "number", description: "Number of results to return (defaults to 20)" }
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

    try {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/pulls?state=${state}&per_page=${perPage}&sort=updated&direction=desc`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitHub API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const prs = await response.json();
      if (!prs.length) return { output: `No ${state} pull requests found.`, isError: false };

      const lines = [`Found ${prs.length} pull request(s) [${state}]:\n`];
      for (const pr of prs) {
        const created = new Date(pr.created_at).toLocaleDateString();
        lines.push(`#${pr.number} [${pr.state}] ${pr.title} — ${pr.user.login} (${created}) -> ${pr.base.ref}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
