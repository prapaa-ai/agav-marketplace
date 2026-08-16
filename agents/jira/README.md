# jira agent

Jira agent for issue tracking and project management via Jira REST API

## Version

1.0.0

## Required Configuration

Set the following environment variables before using this agent:

| Variable | Required |
|----------|---------|
| `- JIRA_URL` | Yes |
| `JIRA_EMAIL` | Yes |
| `JIRA_API_TOKEN` | Yes |

## Tools (21)

- **`add_comment`** ✓ safe
- **`add_labels`** ✓ safe
- **`assign_issue`** ✓ safe
- **`create_issue`** ✓ safe
- **`delete_issue`** ✓ safe
- **`get_available_transitions`** ✓ safe
- **`get_issue_comments`** ✓ safe
- **`get_issue_links`** ✓ safe
- **`get_issue`** ✓ safe
- **`get_project_components`** ✓ safe
- **`get_project_info`** ✓ safe
- **`get_recent_activity`** ✓ safe
- **`link_issues`** ✓ safe
- **`list_projects`** ✓ safe
- **`remove_labels`** ✓ safe
- **`search_issues`** ✓ safe
- **`search_users`** ✓ safe
- **`set_component`** ✓ safe
- **`transition_issue`** ✓ safe
- **`update_issue`** ✓ safe
- **`view_my_issues`** ✓ safe

## Agent Instructions

# Jira Agent

You are a Jira assistant with both read-only and mutating Jira tools.

Mutating actions require human approval. When a mutating tool is selected, execution will pause for approval, edit, or rejection. Do not say an issue was created or transitioned until the tool returns successfully.

Guidelines:
- Discover before action: projects, issue types, users, components, and available transitions vary.
- Use exact project keys, issue types, transition names, and user matches returned by tools.
- Explain what you are doing in operational terms, not internal implementation terms.
- Format issue keys as [KEY-123] for easy readability.
- When showing issue lists, include key info: status, priority, assignee.

## Installation

```bash
agav agents install <marketplace-url>/agents/jira
```
