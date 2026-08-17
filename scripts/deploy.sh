#!/bin/bash
set -euo pipefail

PORT="${PORT:-4000}"
APP_NAME="${APP_NAME:?APP_NAME is required}"
APP_DIR="${APP_DIR:?APP_DIR is required}"
BRANCH_NAME="${BRANCH_NAME:?BRANCH_NAME is required}"
INSTANCE_ID="${INSTANCE_ID:?INSTANCE_ID is required}"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:?SNS_TOPIC_ARN is required}"
REGION="ap-southeast-1"

cleanup_space() {
  echo "Cleaning up space..."
  rm -rf .next .turbo .cache .next/cache node_modules/.cache || true
  rm -f npm-debug.log yarn-error.log pnpm-debug.log || true
  [ -d node_modules ] && rm -rf node_modules || true
  npm cache clean --force || true
  pm2 flush || true
  rm -rf "$HOME/.pm2/logs"/* "$HOME/.cache"/* "$HOME/.npm/_cacache" || true
  find . -maxdepth 1 -type f \( -name "*.log" -o -name "*.tmp" \) -delete || true
  echo "Cleanup complete."
}

fetch_git() {
  mkdir -p "$APP_DIR"
  cd "$APP_DIR"

  if [ ! -d ".git" ]; then
    echo "No git repo found. Cloning fresh..."
    git clone -b "$BRANCH_NAME" https://x-access-token:${GITHUB_TOKEN}@github.com/OmR31997/dev-tweet-backend.git .
  else
    echo "Repo exists. Updating..."
    git fetch origin
    git reset --hard "origin/$BRANCH_NAME"
  fi

  echo "Repo ready at $(pwd)"
}

ensure_needed() {
  command -v aws >/dev/null || { sudo apt-get install -y awscli; }
  aws --version
  [ -f ".env" ] || { echo ".env missing"; exit 1; }
  aws sts get-caller-identity >/dev/null || { echo "AWS auth failed"; exit 1; }
}

ensure_deps() {
  npm ci --legacy-peer-deps --no-audit --no-fund
  npm run build
}

pm2_startup() {
  if pm2 describe "$APP_NAME" &>/dev/null; then
    pm2 reload "$APP_NAME" --update-env
  else
    PORT="$PORT" pm2 start npm --name "$APP_NAME" -- run start
  fi
  pm2 save
}

cloudwatch_config() {
  aws cloudwatch put-metric-data --metric-name DeploySuccess --namespace DevTweetBackend --value 1 --region "$REGION"
  aws cloudwatch put-metric-alarm --alarm-name "${APP_NAME}-HighCPU" --namespace AWS/EC2 --metric-name CPUUtilization \
    --dimensions Name=InstanceId,Value="$INSTANCE_ID" --statistic Average --period 60 --threshold 20 \
    --comparison-operator GreaterThanThreshold --evaluation-periods 5 --datapoints-to-alarm 5 \
    --alarm-actions "$SNS_TOPIC_ARN" --region "$REGION"
  aws cloudwatch put-metric-alarm --alarm-name "${APP_NAME}-HighMemory" --namespace CWAgent --metric-name mem_used_percent \
    --dimensions Name=InstanceId,Value="$INSTANCE_ID" --statistic Average --period 60 --threshold 20 \
    --comparison-operator GreaterThanThreshold --evaluation-periods 5 --datapoints-to-alarm 5 \
    --alarm-actions "$SNS_TOPIC_ARN" --region "$REGION"
}

# === Flow ===
cleanup_space
fetch_git
ensure_needed
ensure_deps
pm2_startup
cloudwatch_config

echo "======================================"
echo "Deployment of $APP_NAME completed successfully."
echo "======================================"
