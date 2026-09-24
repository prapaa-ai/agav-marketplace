export default {
  schema: {
    name: "github_get_issue",
    description: "Get details of a specific GitHub issue",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        issue_number: { type: "number", description: "Issue number" }
      },
      required: ["owner", "repo", "issue_number"]
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
        `https://api.github.com/repos/${input.owner}/${input.repo}/issues/${input.issue_number}`,
        { headers }
      );
      if (!response.ok) {
        return { output: `GitHub API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const issue = await response.json();
      const body = issue.body
        ? issue.body.slice(0, 500) + (issue.body.length > 500 ? "..." : "")
        : "(no description)";
      const labels = issue.labels.map(l => l.name).join(", ") || "none";
      const assignees = issue.assignees.map(a => a.login).join(", ") || "none";
      const lines = [
        `Issue #${issue.number}: ${issue.title} [${issue.state}]`,
        `Author: ${issue.user.login}`,
        `Labels: ${labels}`,
        `Assignees: ${assignees}`,
        `Comments: ${issue.comments}`,
        ``,
        `Description:\n${body}`,
        ``,
        `URL: ${issue.html_url}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
