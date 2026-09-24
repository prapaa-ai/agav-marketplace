export default {
  schema: {
    name: "github_list_commits",
    description: "List commits in a GitHub repository",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        branch: { type: "string", description: "Branch name (defaults to the repository's default branch)" },
        per_page: { type: "number", description: "Number of commits to return (defaults to 20)" }
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

    const perPage = input.per_page || 20;
    const params = new URLSearchParams({ per_page: String(perPage) });
    if (input.branch) params.set("sha", input.branch);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/commits?${params}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitHub API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const commits = await response.json();
      if (!commits.length) return { output: "No commits found.", isError: false };

      const lines = [`Found ${commits.length} commit(s):\n`];
      for (const c of commits) {
        const sha = c.sha.slice(0, 7);
        const author = c.commit.author?.name || c.author?.login || "unknown";
        const msg = (c.commit.message || "").split("\n")[0];
        const date = c.commit.author?.date
          ? new Date(c.commit.author.date).toLocaleDateString()
          : "?";
        lines.push(`${sha} ${author}: ${msg} (${date})`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
