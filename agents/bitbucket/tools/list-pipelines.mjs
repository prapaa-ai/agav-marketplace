export default {
  schema: {
    name: "bitbucket_list_pipelines",
    description: "List recent pipeline runs for a Bitbucket repository",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository slug" },
        limit: { type: "number", description: "Number of pipelines to return (default: 10)" }
      },
      required: ["repo"]
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    const limit = Math.min(Math.max(input.limit || 10, 1), 50);

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}/pipelines/?pagelen=${limit}&sort=-created_on`,
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
      const pipelines = data.values || [];

      if (!pipelines.length) return { output: "No pipelines found.", isError: false };

      const lines = pipelines.map(p => {
        const state = p.state?.name || "unknown";
        const result = p.state?.result?.name ? ` (${p.state.result.name})` : "";
        const ref = p.target?.ref_name || "n/a";
        const duration = p.duration_in_seconds ? formatDuration(p.duration_in_seconds * 1000) : "n/a";
        return `#${p.build_number} | ${state}${result} | ref: ${ref} | ${duration} | ${p.created_on?.split("T")[0] || ""}`;
      });

      return { output: `Pipelines for ${input.repo}:\n\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
