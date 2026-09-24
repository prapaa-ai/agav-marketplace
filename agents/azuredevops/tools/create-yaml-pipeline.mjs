export default {
  schema: {
    name: "ado_create_yaml_pipeline",
    description: "Create a new YAML-based pipeline in Azure DevOps backed by a repository file",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Pipeline name" },
        yaml_path: { type: "string", description: "Path to the YAML file in the repository (e.g. /azure-pipelines.yml)" },
        repo_id: { type: "string", description: "Repository ID (GUID)" },
        repo_name: { type: "string", description: "Repository name" },
        folder: { type: "string", description: "Folder path for the pipeline (e.g. /MyTeam)" },
        project: { type: "string", description: "Project name (defaults to ADO_PROJECT env var)" }
      },
      required: ["name", "yaml_path", "repo_id", "repo_name"]
    }
  },
  async execute(input) {
    const { ADO_ORGANIZATION_URL, ADO_PAT, ADO_PROJECT } = process.env;
    if (!ADO_ORGANIZATION_URL || !ADO_PAT) {
      return { output: "Error: Missing ADO_ORGANIZATION_URL or ADO_PAT", isError: true };
    }
    const project = encodeURIComponent(input.project || ADO_PROJECT || "");
    if (!project) return { output: "Error: No project specified. Set ADO_PROJECT or pass project parameter.", isError: true };

    const auth = Buffer.from(`:${ADO_PAT}`).toString("base64");
    const body = {
      name: input.name,
      folder: input.folder || "/",
      configuration: {
        type: "yaml",
        path: input.yaml_path,
        repository: {
          id: input.repo_id,
          name: input.repo_name,
          type: "azureReposGit"
        }
      }
    };

    try {
      const response = await fetch(
        `${ADO_ORGANIZATION_URL}/${project}/_apis/pipelines?api-version=7.1`,
        {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { output: `Azure DevOps API error (${response.status}): ${err.message || response.statusText}`, isError: true };
      }
      const pipeline = await response.json();
      return { output: `Created pipeline '${pipeline.name}' (ID: ${pipeline.id})`, isError: false };
    } catch (err) {
      return { output: `Error: ${err.message}`, isError: true };
    }
  }
};
