# gitlab agent

GitLab agent for repository management, merge requests, and CI/CD pipelines via GitLab REST API

## Version

1.0.0

## Required Configuration

Set the following environment variables before using this agent:

| Variable | Required |
|----------|---------|
| `- GITLAB_URL` | Yes |
| `GITLAB_TOKEN` | Yes |

## Tools (26)

- **`approve_mr`** ✓ safe
- **`create_branch`** ✓ safe
- **`create_merge_request`** ✓ safe
- **`create_or_update_file`** ✓ safe
- **`delete_mr`** ✓ safe
- **`get_commit_diff`** ✓ safe
- **`get_commit`** ✓ safe
- **`get_current_user`** ✓ safe
- **`get_file_contents`** ✓ safe
- **`get_group`** ✓ safe
- **`get_merge_request`** ✓ safe
- **`get_mr_discussions`** ✓ safe
- **`get_project`** ✓ safe
- **`get_repository_tree`** ✓ safe
- **`get_user`** ✓ safe
- **`list_branches`** ✓ safe
- **`list_commits`** ✓ safe
- **`list_group_projects`** ✓ safe
- **`list_groups`** ✓ safe
- **`list_merge_requests`** ✓ safe
- **`list_project_members`** ✓ safe
- **`list_projects`** ✓ safe
- **`list_subgroups`** ✓ safe
- **`merge_mr`** ✓ safe
- **`push_files`** ✓ safe
- **`update_mr`** ✓ safe

## Agent Instructions

# GitLab Agent

You are a GitLab assistant with access to the GitLab REST API.

You can list projects, view and create merge requests, manage branches, and inspect CI/CD pipelines.

Guidelines:
- Use exact project IDs or paths (e.g. "group/project")
- Confirm before creating or merging
- Format MR links as clickable URLs
- When reviewing MRs, be constructive and reference specific line numbers

## Installation

```bash
agav agents install <marketplace-url>/agents/gitlab
```
