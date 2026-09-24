export default {
  schema: {
    name: "argocd_sync_application",
    description: "Trigger a sync for an Argo CD application to reconcile it with the desired state",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Application name to sync" },
        prune: { type: "boolean", description: "Prune resources that are no longer defined in Git", default: false },
        dry_run: { type: "boolean", description: "Simulate the sync without applying changes", default: false }
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
      const response = await fetch(`${ARGOCD_SERVER_URL}/api/v1/applications/${input.name}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ARGOCD_AUTH_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prune: input.prune ?? false,
          dryRun: input.dry_run ?? false
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Argo CD API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const result = await response.json();
      const phase = result.status?.operationState?.phase || "initiated";
      return {
        output: `Sync ${input.dry_run ? "(dry-run) " : ""}triggered for '${input.name}' — phase: ${phase}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
