export default {
  schema: {
    name: "github_get_repo",
    description: "Get details of a specific GitHub repository",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner (user or organization)" },
        repo: { type: "string", description: "Repository name" }
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

    try {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitHub API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const r = await response.json();
      const topics = r.topics?.length ? r.topics.join(", ") : "(none)";
      const pushed = r.pushed_at ? new Date(r.pushed_at).toLocaleString() : "N/A";
      const visibility = r.visibility || (r.private ? "private" : "public");
      const lines = [
        `${r.full_name} [${visibility}]`,
        `Description: ${r.description || "(none)"}`,
        `Language: ${r.language || "N/A"}`,
        `Stars: ${r.stargazers_count} | Forks: ${r.forks_count} | Open issues: ${r.open_issues_count}`,
        `Default branch: ${r.default_branch}`,
        `Topics: ${topics}`,
        `Last push: ${pushed}`,
        `URL: ${r.html_url}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
