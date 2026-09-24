export default {
  schema: {
    name: "argocd_list_applications",
    description: "List all Argo CD applications with their sync and health status",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Filter by project name" }
      }
    }
  },
  async execute(input) {
    const { ARGOCD_SERVER_URL, ARGOCD_AUTH_TOKEN } = process.env;
    if (!ARGOCD_SERVER_URL || !ARGOCD_AUTH_TOKEN) {
      return { output: "Error: Missing ARGOCD_SERVER_URL or ARGOCD_AUTH_TOKEN", isError: true };
    }

    const params = new URLSearchParams();
    if (input.project) params.set("projects", input.project);

    try {
      const response = await fetch(`${ARGOCD_SERVER_URL}/api/v1/applications?${params}`, {
        headers: { Authorization: `Bearer ${ARGOCD_AUTH_TOKEN}` }
      });
      if (!response.ok) {
        return { output: `Argo CD API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const apps = data.items || [];
      if (!apps.length) return { output: "No applications found.", isError: false };

      const lines = [`Found ${apps.length} application(s):\n`];
      for (const app of apps) {
        const health = app.status?.health?.status || "Unknown";
        const sync = app.status?.sync?.status || "Unknown";
        const dest = `${app.spec?.destination?.server || "?"} / ${app.spec?.destination?.namespace || "?"}`;
        lines.push(`• ${app.metadata.name}\n  Health: ${health} | Sync: ${sync}\n  Destination: ${dest}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
