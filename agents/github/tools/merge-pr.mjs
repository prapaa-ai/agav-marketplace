export default {
  schema: {
    name: "github_merge_pr",
    description: "Merge a pull request in a GitHub repository",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pull_number: { type: "number", description: "Pull request number" },
        merge_method: {
          type: "string",
          enum: ["merge", "squash", "rebase"],
          description: "Merge method (default: merge)"
        },
        commit_title: { type: "string", description: "Custom merge commit title (optional)" },
        commit_message: { type: "string", description: "Custom merge commit message (optional)" }
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
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };

    const body = {};
    if (input.merge_method) body.merge_method = input.merge_method;
    if (input.commit_title) body.commit_title = input.commit_title;
    if (input.commit_message) body.commit_message = input.commit_message;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${input.pull_number}/merge`,
        { method: "PUT", headers, body: JSON.stringify(body) }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitHub API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const result = await response.json();
      return {
        output: `Merged PR #${input.pull_number}\nSHA: ${result.sha}\nMessage: ${result.message}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
