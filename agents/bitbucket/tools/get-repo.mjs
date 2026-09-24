export default {
  schema: {
    name: "bitbucket_get_repo",
    description: "Get details of a specific Bitbucket repository",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository slug" }
      },
      required: ["repo"]
    }
  },
  async execute(input) {
    const { BITBUCKET_WORKSPACE, BITBUCKET_USERNAME, BITBUCKET_APP_PASSWORD } = process.env;
    if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) return { output: "Error: Missing Bitbucket credentials", isError: true };
    if (!BITBUCKET_WORKSPACE) return { output: "Error: Missing BITBUCKET_WORKSPACE", isError: true };

    try {
      const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(BITBUCKET_WORKSPACE)}/${encodeURIComponent(input.repo)}`,
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
      const r = await response.json();

      const lines = [
        `Repository: ${r.full_name}`,
        `Name: ${r.name}`,
        `Slug: ${r.slug}`,
        `Description: ${r.description || "(none)"}`,
        `Visibility: ${r.is_private ? "private" : "public"}`,
        `Language: ${r.language || "n/a"}`,
        `Size: ${r.size ? `${Math.round(r.size / 1024)} KB` : "n/a"}`,
        `Main branch: ${r.mainbranch?.name || "n/a"}`,
        `Created: ${r.created_on}`,
        `Updated: ${r.updated_on}`,
        `URL: ${r.links?.html?.href || "n/a"}`
      ];

      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
