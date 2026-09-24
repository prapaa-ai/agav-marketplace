export default {
  schema: {
    name: "argocd_get_resource_tree",
    description: "Get the resource tree of an Argo CD application showing all managed Kubernetes resources with health and sync status",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "Application name" }
      },
      required: ["app_name"]
    }
  },
  async execute(input) {
    const { ARGOCD_SERVER_URL, ARGOCD_AUTH_TOKEN } = process.env;
    if (!ARGOCD_SERVER_URL || !ARGOCD_AUTH_TOKEN) {
      return { output: "Error: Missing ARGOCD_SERVER_URL or ARGOCD_AUTH_TOKEN", isError: true };
    }

    try {
      const response = await fetch(
        `${ARGOCD_SERVER_URL}/api/v1/applications/${encodeURIComponent(input.app_name)}/resource-tree`,
        { headers: { Authorization: `Bearer ${ARGOCD_AUTH_TOKEN}`, Accept: "application/json" } }
      );
      if (!response.ok) {
        const err = await response.text();
        return { output: `Argo CD API error (${response.status}): ${err}`, isError: true };
      }
      const data = await response.json();
      const nodes = data.nodes || [];
      if (!nodes.length) {
        return { output: `No resources found for application: ${input.app_name}`, isError: false };
      }

      // Build a parent->children map for tree rendering
      const byUid = {};
      for (const node of nodes) {
        byUid[node.uid] = node;
      }

      // Determine roots: nodes whose parentRefs either don't exist or reference nothing in the tree
      const childUids = new Set();
      for (const node of nodes) {
        for (const ref of node.parentRefs || []) {
          if (ref.uid) childUids.add(node.uid);
        }
      }

      const childrenOf = {};
      for (const node of nodes) {
        for (const ref of node.parentRefs || []) {
          if (ref.uid) {
            if (!childrenOf[ref.uid]) childrenOf[ref.uid] = [];
            childrenOf[ref.uid].push(node);
          }
        }
      }

      const roots = nodes.filter(n => !(n.parentRefs || []).some(r => r.uid && byUid[r.uid]));

      function formatNode(node, prefix, isLast) {
        const health = node.health?.status || "Unknown";
        const sync = node.syncStatus || "Unknown";
        const ns = node.namespace ? node.namespace : "-";
        const connector = isLast ? "└── " : "├── ";
        const line = `${prefix}${connector}${node.kind}/${ns}/${node.name} (health: ${health}, sync: ${sync})`;

        const children = childrenOf[node.uid] || [];
        const childPrefix = prefix + (isLast ? "    " : "│   ");
        const childLines = children.map((child, i) =>
          formatNode(child, childPrefix, i === children.length - 1)
        );
        return [line, ...childLines].join("\n");
      }

      const header = `Resource tree for application: ${input.app_name} (${nodes.length} resource(s))\n`;
      const tree = roots.map((root, i) => formatNode(root, "", i === roots.length - 1)).join("\n");
      return { output: header + tree, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
