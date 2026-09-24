export default {
  schema: {
    name: "bitbucket_list_branches",
    description: "List branches in a Bitbucket repository",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository slug" },
        query: { type: "string", description: "Filter branches by name (optional)" },
        limit: { type: "number", description: "Results per page (default: 25)" }
      },
      required: ["repo"]
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    const limit = Math.min(Math.max(input.limit || 25, 1), 100);
    let url = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}/refs/branches?pagelen=${limit}`;
    if (input.query) url += `&q=name~"${encodeURIComponent(input.query)}"`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString("base64")}`
        }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Bitbucket API error (${response.status}): ${err.error?.message || response.statusText}`, isError: true };
      }
      const data = await response.json();
      const branches = data.values || [];

      if (!branches.length) return { output: "No branches found.", isError: false };

      const lines = branches.map(b => {
        const hash = b.target?.hash?.slice(0, 7) || "n/a";
        const date = b.target?.date?.split("T")[0] || "n/a";
        const msg = b.target?.message?.split("\n")[0]?.slice(0, 60) || "";
        return `${b.name} | ${hash} | ${date} | ${msg}`;
      });

      return { output: `Branches in ${input.repo}:\n\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
