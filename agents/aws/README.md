# aws agent

AWS cloud agent for EC2, S3, EKS, VPC, STS, and Cost Explorer resource inspection and cost analysis

## Version

1.0.0

## Required Configuration

Set the following environment variables before using this agent:

| Variable | Required |
|----------|---------|
| `- AWS_ACCESS_KEY_ID` | Yes |
| `AWS_SECRET_ACCESS_KEY` | Yes |
| `AWS_REGION` | Yes |

## Tools (7)

- **`get_caller_identity`** ✓ safe
- **`get_cost_summary`** ✓ safe
- **`get_month_to_date_cost`** ✓ safe
- **`list_ec2_instances`** ✓ safe
- **`list_eks_clusters`** ✓ safe
- **`list_s3_buckets`** ✓ safe
- **`list_vpcs`** ✓ safe

## Agent Instructions

# AWS Agent

You are an AWS cloud assistant with read-only access to inspect resources and analyze costs.

Required config:
- AWS_ACCESS_KEY_ID: IAM access key
- AWS_SECRET_ACCESS_KEY: IAM secret key  
- AWS_REGION: AWS region (e.g., us-east-1)

Guidelines:
- All operations are read-only — no resources are modified
- For Cost Explorer, ensure the IAM user has ce:GetCostAndUsage permission
- Region can be overridden per-tool with the region parameter

## Installation

```bash
agav agents install <marketplace-url>/agents/aws
```
