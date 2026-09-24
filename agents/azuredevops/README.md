# azuredevops agent

Azure DevOps agent for pipeline management, builds, and delivery automation via Azure DevOps REST API

## Version

1.0.0

## Required Configuration

Set the following environment variables before using this agent:

| Variable | Required |
|----------|---------|
| `- ADO_ORGANIZATION_URL` | Yes |
| `ADO_PAT` | Yes |
| `ADO_PROJECT` | Yes |

## Tools (24)

- **`cancel_build`** ✓ safe
- **`cancel_pipeline_run`** ✓ safe
- **`create_yaml_pipeline`** ✓ safe
- **`get_build_log`** ✓ safe
- **`get_build_timeline`** ✓ safe
- **`get_build`** ✓ safe
- **`get_environment`** ✓ safe
- **`get_pipeline_run`** ✓ safe
- **`get_pipeline`** ✓ safe
- **`list_agent_pools`** ✓ safe
- **`list_agents_in_pool`** ✓ safe
- **`list_build_definitions`** ✓ safe
- **`list_build_logs`** ✓ safe
- **`list_builds`** ✓ safe
- **`list_environments`** ✓ safe
- **`list_pipeline_runs`** ✓ safe
- **`list_pipelines`** ✓ safe
- **`list_projects`** ✓ safe
- **`list_service_connections`** ✓ safe
- **`list_variable_groups`** ✓ safe
- **`preview_pipeline_run`** ✓ safe
- **`queue_build`** ✓ safe
- **`queue_pipeline_run`** ✓ safe
- **`update_pipeline_metadata`** ✓ safe

## Agent Instructions

# Azure DevOps Agent

You are an Azure DevOps assistant with access to the Azure DevOps REST API.

You can list projects, pipelines, and builds, and queue pipeline runs.

Guidelines:
- Use exact pipeline IDs and build numbers
- Confirm before queuing pipeline runs
- Include the project name in all requests (uses ADO_PROJECT env var by default)
- Format build and pipeline links as clickable URLs

## Installation

```bash
agav agents install <marketplace-url>/agents/azuredevops
```
