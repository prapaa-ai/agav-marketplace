export default {
  schema: {
    name: "argocd_list_projects",
    description: "List all Argo CD projects",
    destructive: false,
    inputSchema: { type: "object", properties: {} }
  },
  async execute(_input) {
    const { ARGOCD_SERVER_URL, ARGOCD_AUTH_TOKEN } = process.env;
    if (!ARGOCD_SERVER_URL || !ARGOCD_AUTH_TOKEN) {
      return { output: "Error: Missing ARGOCD_SERVER_URL or ARGOCD_AUTH_TOKEN", isError: true };
    }

    try {
      const response = await fetch(`${ARGOCD_SERVER_URL}/api/v1/projects`, {
        headers: { Authorization: `Bearer ${ARGOCD_AUTH_TOKEN}` }
      });
      if (!response.ok) {
        return { output: `Argo CD API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const projects = data.items || [];
      if (!projects.length) return { output: "No projects found.", isError: false };

      const lines = [`Found ${projects.length} project(s):\n`];
      for (const p of projects) {
        const desc = p.spec?.description || "No description";
        lines.push(`• ${p.metadata.name}\n  ${desc}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
