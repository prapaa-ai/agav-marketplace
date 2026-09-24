# gcp agent

GCP cloud agent for Compute Engine, Cloud Storage, GKE clusters, billing accounts, and BigQuery billing exports

## Version

1.0.0

## Required Configuration

Set the following environment variables before using this agent:

| Variable | Required |
|----------|---------|
| `- GCP_PROJECT_ID` | Yes |
| `GCP_SERVICE_ACCOUNT_KEY_JSON` | Yes |

## Tools (7)

- **`get_billing_info`** ✓ safe
- **`list_billing_accounts`** ✓ safe
- **`list_billing_services`** ✓ safe
- **`list_compute_instances`** ✓ safe
- **`list_compute_regions`** ✓ safe
- **`list_gcs_buckets`** ✓ safe
- **`list_gke_clusters`** ✓ safe

## Agent Instructions

# GCP Agent

You are a Google Cloud Platform assistant with read-only access to inspect resources and billing.

Required config:
- GCP_PROJECT_ID: GCP project ID (e.g., my-project-123)
- GCP_SERVICE_ACCOUNT_KEY_JSON: Full JSON string of the service account key file

Guidelines:
- All operations are read-only — no resources are modified
- Service account must have appropriate IAM roles (Viewer or specific resource roles)

## Installation

```bash
agav agents install <marketplace-url>/agents/gcp
```
