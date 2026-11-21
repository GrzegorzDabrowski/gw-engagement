#!/bin/bash
# Runs inside the LocalStack container when it becomes ready.
# Uses the plain aws CLI shipped in the image (awslocal is deprecated),
# pointed at this LocalStack instance. LocalStack accepts any credentials.
set -euo pipefail

export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1
aws_local() { aws --endpoint-url=http://localhost:4566 "$@"; }

BUCKET=gw-packages

# Idempotent: do not fail if the bucket already exists (e.g. state persisted)
if aws_local s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "Bucket ${BUCKET} already exists"
else
  aws_local s3 mb "s3://${BUCKET}"
  echo "Bucket ${BUCKET} created"
fi
