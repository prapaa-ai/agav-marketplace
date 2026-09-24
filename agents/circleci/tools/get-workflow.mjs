export default {
  schema: {
    name: "circleci_get_workflow",
    description: "Get details of a specific CircleCI workflow by ID",
    destructive: false,
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: { type: "string", description: "Workflow UUID" }
      },
      required: ["workflow_id"]
    }
  },
  async execute(input) {
    const { CIRCLECI_TOKEN } = process.env;
    if (!CIRCLECI_TOKEN) return { output: "Error: Missing CIRCLECI_TOKEN", isError: true };

    try {
      const response = await fetch(
        `https://circleci.com/api/v2/workflow/${input.workflow_id}`,
        { headers: { "Circle-Token": CIRCLECI_TOKEN } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `CircleCI API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const w = await response.json();

      const duration = w.stopped_at && w.created_at
        ? formatDuration(new Date(w.stopped_at) - new Date(w.created_at))
        : "still running";

      const lines = [
        `Workflow: ${w.name}`,
        `ID: ${w.id}`,
        `Status: ${w.status}`,
        `Created: ${w.created_at}`,
        `Duration: ${duration}`,
        `Pipeline ID: ${w.pipeline_id}`,
        `Pipeline #: ${w.pipeline_number}`,
        `Project: ${w.project_slug || "n/a"}`
      ];

      return { output: lines.join("\n"), isError: false };
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
