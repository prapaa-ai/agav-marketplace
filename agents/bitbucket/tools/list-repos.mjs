export default {
  schema: {
    name: "bitbucket_list_repos",
    description: "List repositories in the configured Bitbucket workspace",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default: 1)" },
        limit: { type: "number", description: "Results per page (default: 25, max: 100)" }
      },
      required: []
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    const page = input.page || 1;
    const limit = Math.min(Math.max(input.limit || 25, 1), 100);

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}?page=${page}&pagelen=${limit}`,
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
      const repos = data.values || [];

      if (!repos.length) return { output: "No repositories found.", isError: false };

      const lines = repos.map(r => {
        const lang = r.language || "n/a";
        const visibility = r.is_private ? "private" : "public";
        const main = r.mainbranch?.name || "n/a";
        return `${r.slug} | ${visibility} | lang: ${lang} | main: ${main} | updated: ${r.updated_on?.split("T")[0] || "n/a"}`;
      });

      return { output: `Repositories in ${BITBUCKET_WORKSPACE} (page ${page}):\n\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
