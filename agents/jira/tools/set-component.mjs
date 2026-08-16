/**
 * Set the component on a Jira issue, looked up by name
 */

export default {
  schema: {
    name: "jira_set_component",
    description: "Set a component on a Jira issue by component name. The component must exist in the specified project. Use jira_get_project_components to list available components.",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        issue_key: {
          type: "string",
          description: "The Jira issue key (e.g., PROJ-123)",
        },
        component_name: {
          type: "string",
          description: "Name of the component to set on the issue (case-sensitive)",
        },
        project_key: {
          type: "string",
          description: "The project key — needed to look up the component ID (e.g., 'PROJ')",
        },
      },
      required: ["issue_key", "component_name", "project_key"],
    },
  },
  async execute(input) {
    const { JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

    if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      return {
        output: "Error: Missing Jira credentials. Please configure JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN.",
        isError: true,
      };
    }

    const issueKey = input.issue_key;
    const componentName = input.component_name;
    const projectKey = input.project_key;

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" };

      // GET project components to resolve name → ID
      const compUrl = `${JIRA_URL}/rest/api/3/project/${projectKey}/components`;
      const compResponse = await fetch(compUrl, { headers });

      if (!compResponse.ok) {
        if (compResponse.status === 404) {
          return {
            output: `Project '${projectKey}' not found.`,
            isError: true,
          };
        }
        const errorText = await compResponse.text();
        return {
          output: `Jira API error fetching components (${compResponse.status}): ${errorText}`,
          isError: true,
        };
      }

      const components = await compResponse.json();
      const matched = components.find(
        (c) => c.name.toLowerCase() === componentName.toLowerCase()
      );

      if (!matched) {
        const available = components.map((c) => c.name).join(", ") || "(none)";
        return {
          output: `Component '${componentName}' not found in project '${projectKey}'.\nAvailable components: ${available}`,
          isError: true,
        };
      }

      // PUT issue with component
      const putUrl = `${JIRA_URL}/rest/api/3/issue/${issueKey}`;
      const putResponse = await fetch(putUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({ fields: { components: [{ id: matched.id }] } }),
      });

      if (!putResponse.ok) {
        if (putResponse.status === 404) {
          return {
            output: `Issue ${issueKey} not found.`,
            isError: true,
          };
        }
        const errorData = await putResponse.json().catch(() => null);
        const errorMsg = errorData?.errors
          ? Object.entries(errorData.errors).map(([f, m]) => `${f}: ${m}`).join(", ")
          : `HTTP ${putResponse.status}`;
        return {
          output: `Failed to set component on [${issueKey}]: ${errorMsg}`,
          isError: true,
        };
      }

      return {
        output: `Set component '${matched.name}' (ID: ${matched.id}) on [${issueKey}].`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error setting component: ${error.message}`,
        isError: true,
      };
    }
  },
};
