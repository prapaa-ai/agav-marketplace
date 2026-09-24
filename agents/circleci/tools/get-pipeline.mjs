export default {
  schema: {
    name: "circleci_get_pipeline",
    description: "Get details of a specific CircleCI pipeline by ID",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "string", description: "Pipeline UUID" }
      },
      required: ["pipeline_id"]
    }
  },
  async execute(input) {
    const { CIRCLECI_TOKEN } = process.env;
    if (!CIRCLECI_TOKEN) return { output: "Error: Missing CIRCLECI_TOKEN", isError: true };

    try {
      const response = await fetch(
        `https://circleci.com/api/v2/pipeline/${input.pipeline_id}`,
        { headers: { "Circle-Token": CIRCLECI_TOKEN } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `CircleCI API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const p = await response.json();

      const lines = [
        `Pipeline #${p.number}`,
        `ID: ${p.id}`,
        `State: ${p.state}`,
        `Created: ${p.created_at}`,
        `Trigger: ${p.trigger?.type || "unknown"}`,
      ];
      if (p.vcs) {
        lines.push(`Branch: ${p.vcs.branch || "n/a"}`);
        lines.push(`Revision: ${p.vcs.revision?.slice(0, 7) || "n/a"}`);
        if (p.vcs.tag) lines.push(`Tag: ${p.vcs.tag}`);
      }

      return { output: lines.join("\n"), isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
