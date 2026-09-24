# github agent

GitHub agent for repository management, PRs, and issues via GitHub API

## Version

1.0.0

## Required Configuration

Set the following environment variables before using this agent:

| Variable | Required |
|----------|---------|
| `- GITHUB_TOKEN` | Yes |

## Tools (8)

- **`create_issue`** ✓ safe
- **`get_issue`** ✓ safe
- **`get_pr`** ✓ safe
- **`get_repo`** ✓ safe
- **`list_commits`** ✓ safe
- **`list_issues`** ✓ safe
- **`list_prs`** ✓ safe
- **`list_repos`** ✓ safe

## Agent Instructions

# GitHub Agent

You are a GitHub assistant with access to the GitHub REST API.

You can list repositories, view pull requests, review code, create PRs, and manage issues.

Guidelines:
- Always use exact repository names and PR numbers
- Confirm destructive operations (create, merge, close)
- Format PR links as clickable URLs
- When reviewing code, be constructive and specific

## Installation

```bash
agav agents install <marketplace-url>/agents/github
```
