#!/usr/bin/env bash
# Creates the DynamoDB leads table, once, with point-in-time backups on.
# Run wherever the AWS CLI is logged in with permission to create it:
#   bash deploy/create-tables.sh
set -euo pipefail
R=${AWS_REGION:-ap-southeast-1}
T=${DYNAMODB_TABLE_PREFIX:-survey-}leads

if aws dynamodb describe-table --region "$R" --table-name "$T" >/dev/null 2>&1; then
  echo "$T already exists"
else
  aws dynamodb create-table --region "$R" --table-name "$T" --billing-mode PAY_PER_REQUEST \
    --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH >/dev/null
  aws dynamodb wait table-exists --region "$R" --table-name "$T"
  echo "$T created"
fi
aws dynamodb update-continuous-backups --region "$R" --table-name "$T" \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true >/dev/null

echo "$T ready in $R, with point-in-time backups."
