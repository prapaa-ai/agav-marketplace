export default {
  schema: {
    name: "circleci_trigger_pipeline",
    description: "Trigger a new pipeline for a CircleCI project",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        project_slug: { type: "string", description: "Project slug e.g. 'gh/org-name/repo-name'" },
        branch: { type: "string", description: "Branch to build (default: project default branch)" },
        parameters: {
          type: "object",
          description: "Pipeline parameters as key-value pairs (optional)",
          additionalProperties: true
        }
      },
      required: ["project_slug"]
    }
  },
  async execute(input) {
    const { CIRCLECI_TOKEN } = process.env;
    if (!CIRCLECI_TOKEN) return { output: "Error: Missing CIRCLECI_TOKEN", isError: true };

    const body = {};
    if (input.branch) body.branch = input.branch;
    if (input.parameters && Object.keys(input.parameters).length) body.parameters = input.parameters;

    try {
      const response = await fetch(
        `https://circleci.com/api/v2/project/${input.project_slug}/pipeline`,
        {
          method: "POST",
          headers: {
            "Circle-Token": CIRCLECI_TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `CircleCI API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const p = await response.json();

      return {
        output: `Triggered pipeline #${p.number}\nID: ${p.id}\nState: ${p.state}\nCreated: ${p.created_at}`,
        isError: false
      };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
