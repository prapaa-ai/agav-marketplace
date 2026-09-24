export default {
  schema: {
    name: "argocd_list_clusters",
    description: "List all clusters registered in Argo CD",
    destructive: false,
    inputSchema: { type: "object", properties: {} }
  },
  async execute(_input) {
    const { ARGOCD_SERVER_URL, ARGOCD_AUTH_TOKEN } = process.env;
    if (!ARGOCD_SERVER_URL || !ARGOCD_AUTH_TOKEN) {
      return { output: "Error: Missing ARGOCD_SERVER_URL or ARGOCD_AUTH_TOKEN", isError: true };
    }

    try {
      const response = await fetch(`${ARGOCD_SERVER_URL}/api/v1/clusters`, {
        headers: { Authorization: `Bearer ${ARGOCD_AUTH_TOKEN}` }
      });
      if (!response.ok) {
        return { output: `Argo CD API error (${response.status}): ${response.statusText}`, isError: true };
      }
      const data = await response.json();
      const clusters = data.items || [];
      if (!clusters.length) return { output: "No clusters found.", isError: false };

      const lines = [`Found ${clusters.length} cluster(s):\n`];
      for (const c of clusters) {
        const name = c.name || "(in-cluster)";
        const info = c.info?.serverVersion ? `Kubernetes ${c.info.serverVersion}` : "";
        const apps = c.info?.applicationsCount ?? "?";
        lines.push(`• ${name}\n  Server: ${c.server}\n  ${info} | Apps: ${apps}`);
      }
      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
