#!/usr/bin/env bash
# Creates the three DynamoDB tables, once, with point-in-time backups on.
# Run wherever the AWS CLI is logged in with permission to create them:
#   bash deploy/create-tables.sh
set -euo pipefail
R=${AWS_REGION:-ap-southeast-1}
P=${DYNAMODB_TABLE_PREFIX:-survey-}

make() {  # name, then attribute definitions and key schema
  local name=$1; shift
  if aws dynamodb describe-table --region "$R" --table-name "$P$name" >/dev/null 2>&1; then
    echo "$P$name already exists"
  else
    aws dynamodb create-table --region "$R" --table-name "$P$name" --billing-mode PAY_PER_REQUEST "$@" >/dev/null
    aws dynamodb wait table-exists --region "$R" --table-name "$P$name"
    echo "$P$name created"
  fi
  aws dynamodb update-continuous-backups --region "$R" --table-name "$P$name" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true >/dev/null
}

make leads --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH
make conversations --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH
make messages \
  --attribute-definitions AttributeName=conversation_id,AttributeType=S AttributeName=at,AttributeType=S \
  --key-schema AttributeName=conversation_id,KeyType=HASH AttributeName=at,KeyType=RANGE

echo "Tables ready in $R, with point-in-time backups."
