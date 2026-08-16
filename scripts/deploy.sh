#!/bin/bash

set -euo pipefail

PORT="${PORT:-4000}"
APP_NAME="${APP_NAME:?APP_NAME is required}"
APP_DIR="${APP_DIR:?APP_DIR is required}"
BRANCH_NAME="${BRANCH_NAME:?BRANCH_NAME is required}"

cleanup_space(){
  echo "Cleaning up space..."
  rm -rf .next .turbo .cache .next/cache node_modules/.cache || true
  rm -f npm-debug.log yarn-error.log pnpm-debug.log || true

  if [[ -d "node_modules" ]]; then
    rm -rf node_modules/.cache || true
    rm -rf node_modules || true
  fi

  if command -v npm &> /dev/null; then
    npm cache clean --force || true
  fi

  if command -v pm2 &> /dev/null; then
    pm2 flush || true
    rm -rf "$HOME/.pm2/logs"/* 2>/dev/null || true
  fi

  rm -rf "$HOME/.cache"/* "$HOME/.cache/npm" "$HOME/.npm/_cacache" 2>/dev/null || true
  find . -maxdepth 1 -type f \( -name "*.log" -o -name "*.tmp" -o -name "*.temp" \) -delete 2>/dev/null || true
  echo "Cleanup complete."
}

fetch_latest_code(){
    echo "Fetching latest code..."

    if git fetch origin; then
        echo "Successfully fetched latest code."
    else
        echo "Failed to fetch latest code. Please check your network connection and repository access."
        exit 1
    fi

    if ! git diff-index --quiet HEAD --; then
        echo "Uncommitted changes present. Please commit or stash before deploy."
        exit 1
    fi

    echo "Updating branch..."
    if ! git pull --ff-only origin "$BRANCH_NAME"; then
        echo "Branch update failed: divergence detected. Deployment aborted."
        exit 1
    fi

}

echo "======================================"
echo "Deploying $APP_NAME"
echo "Branch: $BRANCH_NAME"
echo "Directory: $APP_DIR"
echo "======================================"

cd "$APP_DIR"
fetch_latest_code
cleanup_space

cd "$APP_DIR/backend"
echo "Current working directory: $(pwd)"
if ! [[ -f ".env" ]]; then
    echo ".env file not found. Please ensure it exists in the repository."
    exit 1
fi

echo "Installing dependencies..."
pwd
ls -lah
if npm install --legacy-peer-deps --no-audit --no-fund; then
    echo "Dependencies installed successfully."
else
    echo "Dependency installation failed. Please check the logs for details."
    exit 1
fi 

echo "Building the application..."

if npm run build; then
    echo "Build successful."
else
    echo "Build failed. Please check the build logs for details."
    exit 1
fi

if pm2 describe "$APP_NAME" &> /dev/null; then
    echo "Restarting the application using PM2..."
    if pm2 reload "$APP_NAME" --update-env; then
        echo "Application restarted successfully."
    else
        echo "Failed to restart the application. Please check PM2 logs for details."
        exit 1
    fi
else
    echo "Starting the application using PM2..."
    if PORT=4000 pm2 start npm --name "$APP_NAME" --namespace "API-DT-4000" -- run start; then
        echo "Application started successfully."
    else
        echo "Failed to start the application. Please check PM2 logs for details."
        exit 1
    fi
fi

pm2 save
echo "Deployment of $APP_NAME completed successfully."