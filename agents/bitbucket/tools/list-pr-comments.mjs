export default {
  schema: {
    name: "bitbucket_list_pr_comments",
    description: "List comments on a Bitbucket pull request",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository slug" },
        pr_id: { type: "number", description: "Pull request ID" }
      },
      required: ["repo", "pr_id"]
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}/pullrequests/${input.pr_id}/comments?pagelen=50`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString("base64")}`
          }
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Bitbucket API error (${response.status}): ${err.error?.message || response.statusText}`, isError: true };
      }
      const data = await response.json();
      const comments = data.values || [];

      if (!comments.length) return { output: "No comments on this pull request.", isError: false };

      const lines = comments.map(c => {
        const author = c.user?.display_name || "unknown";
        const body = c.content?.raw || "(empty)";
        const truncated = body.length > 500 ? body.slice(0, 500) + "..." : body;
        const inline = c.inline ? ` [${c.inline.path}:${c.inline.to || c.inline.from || "?"}]` : "";
        return `${author}${inline} (${c.created_on?.split("T")[0] || ""}):\n  ${truncated}`;
      });

      return { output: `Comments on PR #${input.pr_id}:\n\n${lines.join("\n\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
