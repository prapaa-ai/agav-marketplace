export default {
  schema: {
    name: "bitbucket_list_commits",
    description: "List recent commits in a Bitbucket repository, optionally for a specific branch",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository slug" },
        branch: { type: "string", description: "Branch name (optional, defaults to main branch)" },
        limit: { type: "number", description: "Number of commits to return (default: 20)" }
      },
      required: ["repo"]
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    const limit = Math.min(Math.max(input.limit || 20, 1), 50);
    const branchPath = input.branch ? `/${encodeURIComponent(input.branch)}` : "";

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}/commits${branchPath}?pagelen=${limit}`,
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
      const commits = data.values || [];

      if (!commits.length) return { output: "No commits found.", isError: false };

      const lines = commits.map(c => {
        const hash = c.hash?.slice(0, 7) || "n/a";
        const msg = c.message?.split("\n")[0]?.slice(0, 80) || "(no message)";
        const date = c.date?.split("T")[0] || "n/a";
        const author = c.author?.raw || c.author?.user?.display_name || "unknown";
        return `${hash} | ${date} | ${author} | ${msg}`;
      });

      const label = input.branch ? `Commits on ${input.branch}` : "Recent commits";
      return { output: `${label} in ${input.repo}:\n\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
