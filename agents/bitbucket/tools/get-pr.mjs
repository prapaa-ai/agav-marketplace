export default {
  schema: {
    name: "bitbucket_get_pr",
    description: "Get details of a specific Bitbucket pull request",
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
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}/pullrequests/${input.pr_id}`,
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
      const pr = await response.json();

      const reviewers = (pr.reviewers || []).map(r => r.display_name).join(", ") || "none";

      const lines = [
        `PR #${pr.id}: ${pr.title}`,
        `State: ${pr.state}`,
        `Author: ${pr.author?.display_name || "unknown"}`,
        `Source: ${pr.source?.branch?.name || "?"}`,
        `Destination: ${pr.destination?.branch?.name || "?"}`,
        `Reviewers: ${reviewers}`,
        `Created: ${pr.created_on}`,
        `Updated: ${pr.updated_on}`,
        `URL: ${pr.links?.html?.href || "n/a"}`
      ];
      if (pr.description) {
        const desc = pr.description.length > 500 ? pr.description.slice(0, 500) + "..." : pr.description;
        lines.push(`\nDescription:\n${desc}`);
      }
      if (pr.merge_commit) {
        lines.push(`Merge commit: ${pr.merge_commit.hash?.slice(0, 7) || "n/a"}`);
      }

      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
