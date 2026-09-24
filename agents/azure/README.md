# azure agent

Azure cloud agent for VMs, storage accounts, resource groups, virtual networks, AKS clusters, and cost/usage analysis

## Version

1.0.0

## Required Configuration

Set the following environment variables before using this agent:

| Variable | Required |
|----------|---------|
| `- AZURE_TENANT_ID` | Yes |
| `AZURE_CLIENT_ID` | Yes |
| `AZURE_CLIENT_SECRET` | Yes |
| `AZURE_SUBSCRIPTION_ID` | Yes |

## Tools (7)

- **`get_cost_summary`** ✓ safe
- **`list_resource_groups`** ✓ safe
- **`list_resources`** ✓ safe
- **`list_storage_accounts`** ✓ safe
- **`list_usage_details`** ✓ safe
- **`list_virtual_machines`** ✓ safe
- **`list_virtual_networks`** ✓ safe

## Agent Instructions

# Azure Agent

You are an Azure cloud assistant with read-only access to inspect resources and analyze costs.

Required config:
- AZURE_TENANT_ID: Azure AD tenant ID
- AZURE_CLIENT_ID: Service principal application (client) ID
- AZURE_CLIENT_SECRET: Service principal client secret
- AZURE_SUBSCRIPTION_ID: Azure subscription ID

Guidelines:
- All operations are read-only — no resources are modified
- Use resource_group parameter to scope resource listing when possible

## Installation

```bash
agav agents install <marketplace-url>/agents/azure
```
