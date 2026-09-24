export default {
  schema: {
    name: "bitbucket_merge_pr",
    description: "Merge a pull request in a Bitbucket repository",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository slug" },
        pr_id: { type: "number", description: "Pull request ID" },
        merge_strategy: {
          type: "string",
          enum: ["merge_commit", "squash", "fast_forward"],
          description: "Merge strategy (default: merge_commit)"
        },
        close_source_branch: {
          type: "boolean",
          description: "Delete the source branch after merge (default: false)"
        }
      },
      required: ["repo", "pr_id"]
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    const body = {
      type: "pullrequest",
      merge_strategy: input.merge_strategy || "merge_commit",
      close_source_branch: input.close_source_branch || false
    };

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}/pullrequests/${input.pr_id}/merge`,
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
      const result = await response.json();
      const hash = result.merge_commit?.hash?.slice(0, 7) || "n/a";

      return {
        output: `Merged PR #${input.pr_id} successfully.\nMerge commit: ${hash}\nStrategy: ${input.merge_strategy || "merge_commit"}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
