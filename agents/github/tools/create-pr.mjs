export default {
  schema: {
    name: "github_create_pr",
    description: "Create a new pull request in a GitHub repository",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "Pull request title" },
        head: { type: "string", description: "Branch containing changes (e.g. 'feature-branch')" },
        base: { type: "string", description: "Branch to merge into (e.g. 'main')" },
        body: { type: "string", description: "Pull request description (optional)" },
        draft: { type: "boolean", description: "Create as draft PR (optional, default false)" }
      },
      required: ["owner", "repo", "title", "head", "base"]
    }
  },
  async execute(input) {
    const { GITHUB_TOKEN } = process.env;
    if (!GITHUB_TOKEN) return { output: "Error: Missing GITHUB_TOKEN", isError: true };

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };

    const body = {
      title: input.title,
      head: input.head,
      base: input.base
    };
    if (input.body) body.body = input.body;
    if (input.draft) body.draft = true;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/pulls`,
        { method: "POST", headers, body: JSON.stringify(body) }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitHub API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const pr = await response.json();
      return {
        output: `Created PR #${pr.number}: ${pr.title}\nState: ${pr.draft ? "draft" : pr.state}\nURL: ${pr.html_url}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
