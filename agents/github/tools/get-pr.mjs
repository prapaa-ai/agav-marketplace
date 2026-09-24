export default {
  schema: {
    name: "github_get_pr",
    description: "Get details of a specific GitHub pull request",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pull_number: { type: "number", description: "Pull request number" }
      },
      required: ["owner", "repo", "pull_number"]
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
        `https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${input.pull_number}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitHub API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const pr = await response.json();
      const body = pr.body
        ? pr.body.slice(0, 500) + (pr.body.length > 500 ? "..." : "")
        : "(no description)";
      const lines = [
        `PR #${pr.number}: ${pr.title} [${pr.state}]`,
        `Author: ${pr.user.login}`,
        `Branch: ${pr.head.ref} -> ${pr.base.ref}`,
        `Commits: ${pr.commits} | +${pr.additions} -${pr.deletions}`,
        `Comments: ${pr.comments} | Review comments: ${pr.review_comments}`,
        ``,
        `Description:\n${body}`,
        ``,
        `URL: ${pr.html_url}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
