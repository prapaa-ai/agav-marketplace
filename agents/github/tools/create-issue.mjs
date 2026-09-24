export default {
  schema: {
    name: "github_create_issue",
    description: "Create a new issue in a GitHub repository",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Issue body/description (optional)" },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to apply (optional)"
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "GitHub usernames to assign (optional)"
        }
      },
      required: ["owner", "repo", "title"]
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

    const body = { title: input.title };
    if (input.body) body.body = input.body;
    if (input.labels?.length) body.labels = input.labels;
    if (input.assignees?.length) body.assignees = input.assignees;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/issues`,
        { method: "POST", headers, body: JSON.stringify(body) }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `GitHub API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const issue = await response.json();
      return { output: `Created issue #${issue.number}: ${issue.title}\nURL: ${issue.html_url}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
