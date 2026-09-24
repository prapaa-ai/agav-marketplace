export default {
  schema: {
    name: "circleci_cancel_workflow",
    description: "Cancel a running CircleCI workflow",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: { type: "string", description: "Workflow UUID to cancel" }
      },
      required: ["workflow_id"]
    }
  },
  async execute(input) {
    const { CIRCLECI_TOKEN } = process.env;
    if (!CIRCLECI_TOKEN) return { output: "Error: Missing CIRCLECI_TOKEN", isError: true };

    try {
      const response = await fetch(
        `https://circleci.com/api/v2/workflow/${input.workflow_id}/cancel`,
        {
          method: "POST",
          headers: {
            "Circle-Token": CIRCLECI_TOKEN,
            "Content-Type": "application/json"
          }
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `CircleCI API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }

      return { output: `Workflow ${input.workflow_id} canceled successfully.`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
