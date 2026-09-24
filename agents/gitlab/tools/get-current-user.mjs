export default {
  schema: {
    name: "gitlab_get_current_user",
    description: "Get the profile of the currently authenticated GitLab user",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  async execute(_input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/user`, { headers });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const u = await response.json();

      const lines = [
        `Username: ${u.username}`,
        `Name: ${u.name}`,
        `Email: ${u.email || "(not disclosed)"}`,
        `State: ${u.state}`,
        `Created: ${u.created_at ? new Date(u.created_at).toLocaleDateString() : "unknown"}`,
        `URL: ${u.web_url}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
