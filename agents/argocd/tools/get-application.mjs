export default {
  schema: {
    name: "argocd_get_application",
    description: "Get detailed status of a specific Argo CD application",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name" }
      },
      required: ["name"]
    }
  },
  async execute(input) {
    const { ARGOCD_SERVER_URL, ARGOCD_AUTH_TOKEN } = process.env;
    if (!ARGOCD_SERVER_URL || !ARGOCD_AUTH_TOKEN) {
      return { output: "Error: Missing ARGOCD_SERVER_URL or ARGOCD_AUTH_TOKEN", isError: true };
    }

    try {
      const response = await fetch(`${ARGOCD_SERVER_URL}/api/v1/applications/${input.name}`, {
        headers: { Authorization: `Bearer ${ARGOCD_AUTH_TOKEN}` }
      });
      if (!response.ok) {
        return { output: `Argo CD API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const app = await response.json();

      const health = app.status?.health?.status || "Unknown";
      const sync = app.status?.sync?.status || "Unknown";
      const revision = app.status?.sync?.revision?.slice(0, 8) || "?";
      const conditions = (app.status?.conditions || []).map(c => `  ⚠ ${c.message}`).join("\n");

      const lines = [
        `Application: ${app.metadata.name}`,
        `Project: ${app.spec?.project || "default"}`,
        ``,
        `Health: ${health}`,
        `Sync: ${sync} (revision: ${revision})`,
        ``,
        `Source: ${app.spec?.source?.repoURL || "?"} @ ${app.spec?.source?.targetRevision || "HEAD"}`,
        `Path: ${app.spec?.source?.path || "/"}`,
        `Destination: ${app.spec?.destination?.server || "?"} / ${app.spec?.destination?.namespace || "?"}`,
      ];
      if (conditions) {
        lines.push(``, `Conditions:`, conditions);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
