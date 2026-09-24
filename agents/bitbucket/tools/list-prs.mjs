export default {
  schema: {
    name: "bitbucket_list_prs",
    description: "List pull requests for a Bitbucket repository",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository slug" },
        state: {
          type: "string",
          enum: ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"],
          description: "Filter by PR state (default: OPEN)"
        },
        limit: { type: "number", description: "Results per page (default: 25)" }
      },
      required: ["repo"]
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    const state = input.state || "OPEN";
    const limit = Math.min(Math.max(input.limit || 25, 1), 50);

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}/pullrequests?state=${state}&pagelen=${limit}`,
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
      const prs = data.values || [];

      if (!prs.length) return { output: `No ${state} pull requests found.`, isError: false };

      const lines = prs.map(pr => {
        const src = pr.source?.branch?.name || "?";
        const dst = pr.destination?.branch?.name || "?";
        return `#${pr.id} | ${pr.title} | ${pr.state} | ${src} → ${dst} | by ${pr.author?.display_name || "unknown"} | ${pr.updated_on?.split("T")[0] || ""}`;
      });

      return { output: `Pull requests (${state}) for ${input.repo}:\n\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
