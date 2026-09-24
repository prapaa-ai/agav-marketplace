export default {
  schema: {
    name: "circleci_list_workflows",
    description: "List workflows for a CircleCI pipeline",
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
        `https://circleci.com/api/v2/pipeline/${input.pipeline_id}/workflow`,
        { headers: { "Circle-Token": CIRCLECI_TOKEN } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `CircleCI API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const data = await response.json();
      const workflows = data.items || [];

      if (!workflows.length) return { output: "No workflows found for this pipeline.", isError: false };

      const lines = workflows.map(w => {
        const duration = w.stopped_at && w.created_at
          ? formatDuration(new Date(w.stopped_at) - new Date(w.created_at))
          : "running";
        return `${w.name} | ${w.status} | ${duration} | id: ${w.id}`;
      });

      return { output: `Workflows for pipeline ${input.pipeline_id}:\n\n${lines.join("\n")}`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
