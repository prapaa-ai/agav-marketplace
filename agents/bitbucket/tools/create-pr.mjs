export default {
  schema: {
    name: "bitbucket_create_pr",
    description: "Create a new pull request in a Bitbucket repository",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository slug" },
        title: { type: "string", description: "Pull request title" },
        source_branch: { type: "string", description: "Source branch name" },
        destination_branch: { type: "string", description: "Destination branch name (default: main)" },
        description: { type: "string", description: "Pull request description (optional)" },
        reviewers: {
          type: "array",
          items: { type: "string" },
          description: "Bitbucket account UUIDs of reviewers (optional)"
        }
      },
      required: ["repo", "title", "source_branch"]
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    const body = {
      title: input.title,
      source: { branch: { name: input.source_branch } },
      destination: { branch: { name: input.destination_branch || "main" } }
    };
    if (input.description) body.description = input.description;
    if (input.reviewers?.length) body.reviewers = input.reviewers.map(uuid => ({ uuid }));

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}/pullrequests`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString("base64")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Bitbucket API error (${response.status}): ${err.error?.message || response.statusText}`, isError: true };
      }
      const pr = await response.json();

      return {
        output: `Created PR #${pr.id}: ${pr.title}\nState: ${pr.state}\nURL: ${pr.links?.html?.href || "n/a"}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
