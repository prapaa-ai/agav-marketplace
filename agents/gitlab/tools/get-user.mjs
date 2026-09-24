export default {
  schema: {
    name: "gitlab_get_user",
    description: "Get a GitLab user's profile by numeric ID or username",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Numeric user ID or username string" }
      },
      required: ["user_id"]
    }
  },
  async execute(input) {
    const { GITLAB_URL, GITLAB_TOKEN } = process.env;
    if (!GITLAB_URL || !GITLAB_TOKEN) return { output: "Error: Missing GITLAB_URL or GITLAB_TOKEN", isError: true };
    const headers = { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" };

    const isNumeric = /^\d+$/.test(input.user_id.trim());
    const url = isNumeric
      ? `${GITLAB_URL}/api/v4/users/${input.user_id}`
      : `${GITLAB_URL}/api/v4/users?username=${encodeURIComponent(input.user_id)}`;

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        return { output: `GitLab API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const u = Array.isArray(data) ? data[0] : data;

      if (!u) return { output: `No user found for '${input.user_id}'.`, isError: false };

      const lines = [
        `Username: ${u.username}`,
        `Name: ${u.name}`,
        `Email: ${u.email || "(not disclosed)"}`,
        `State: ${u.state}`,
        `URL: ${u.web_url}`
      ];
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
