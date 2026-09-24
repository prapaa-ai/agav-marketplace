export default {
  schema: {
    name: "circleci_list_workflow_jobs",
    description: "List jobs in a CircleCI workflow",
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
        `https://circleci.com/api/v2/workflow/${input.workflow_id}/job`,
        { headers: { "Circle-Token": CIRCLECI_TOKEN } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `CircleCI API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const data = await response.json();
      const jobs = data.items || [];

      if (!jobs.length) return { output: "No jobs found for this workflow.", isError: false };

      const lines = jobs.map(j => {
        const duration = j.stopped_at && j.started_at
          ? formatDuration(new Date(j.stopped_at) - new Date(j.started_at))
          : (j.started_at ? "running" : "queued");
        const deps = j.dependencies?.length ? ` | depends: ${j.dependencies.length} job(s)` : "";
        return `${j.name} | ${j.status} | ${duration} | #${j.job_number || "n/a"}${deps}`;
      });

      return { output: `Jobs in workflow ${input.workflow_id}:\n\n${lines.join("\n")}`, isError: false };
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
