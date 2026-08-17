#!/bin/bash

set -euo pipefail

PORT="${PORT:-4000}"
APP_NAME="${APP_NAME:?APP_NAME is required}"
APP_DIR="${APP_DIR:?APP_DIR is required}"
BRANCH_NAME="${BRANCH_NAME:?BRANCH_NAME is required}"
INSTANCE_ID="${INSTANCE_ID:?INSTANCE_ID is required}"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:?SNS_TOPIC_ARN is required}"

REGION="ap-southeast-1"

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

    rm -rf "$HOME/.cache"/* \
           "$HOME/.cache/npm" \
           "$HOME/.npm/_cacache" 2>/dev/null || true

    find . -maxdepth 1 -type f \
        \( -name "*.log" -o -name "*.tmp" -o -name "*.temp" \) \
        -delete 2>/dev/null || true

    echo "Cleanup complete."
}

fetch_git(){

    # Ensure APP_DIR exists
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"

    if [ ! -d ".git" ]; then
        echo "No git repo found. Cloning fresh..."
        git clone -b "$BRANCH_NAME" git@github.com:OmR31997/dev-tweet-backend.git .
    else
        echo "Repo exists. Updating..."
        git remote set-url origin git@github.com:OmR31997/dev-tweet-backend.git

        if ! git fetch origin; then
            echo "Failed to fetch latest code. Please check your network connection and repository access."
            exit 1
        fi

        echo "Successfully fetched latest code."

        if ! git diff-index --quiet HEAD --; then
            echo "Uncommitted changes present. Please commit or stash before deploy."
            exit 1
        fi

        echo "Updating branch..."

        if ! git pull --ff-only origin "$BRANCH_NAME"; then
            echo "Branch update failed: divergence detected. Deployment aborted."
            exit 1
        fi

    fi

    echo "======================================"
    echo "||  Deploying $APP_NAME             ||"
    echo "||  Branch: $BRANCH_NAME            ||"
    echo "||  Directory: $APP_DIR             ||"
    echo "======================================"

    cd "$APP_DIR"

    echo "Current working directory: $(pwd)"
}

ensure_needed(){

    # -----------------------------------
    # AWS CLI
    # -----------------------------------

    if ! command -v aws >/dev/null 2>&1; then
        echo "AWS CLI is not installed. Installing..."

        sudo apt-get update
        sudo apt-get install -y awscli
    fi

    echo "AWS CLI version:"
    aws --version

    # -----------------------------------
    # Environment file
    # -----------------------------------

    if [[ ! -f ".env" ]]; then
        echo ".env file not found. Please ensure it exists in the repository."
        exit 1
    fi

    # -----------------------------------
    # AWS Authentication
    # -----------------------------------

    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo "AWS authentication failed."
        echo "Please attach an IAM role to this EC2 instance."
        exit 1
    fi

    echo "AWS authentication successful."

    # -----------------------------------
    # WGET
    # -----------------------------------

    if ! command -v wget >/dev/null 2>&1; then
        echo "wget is not installed. Installing..."

        sudo apt-get update
        sudo apt-get install -y wget
    fi

    # -----------------------------------
    # CloudWatch Agent
    # -----------------------------------

    if [[ ! -f "/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl" ]]; then

        echo "CloudWatch Agent is not installed. Installing..."

        wget -q \
            "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb" \
            -O /tmp/amazon-cloudwatch-agent.deb

        sudo dpkg -i /tmp/amazon-cloudwatch-agent.deb

        rm -f /tmp/amazon-cloudwatch-agent.deb

        echo "CloudWatch Agent installed successfully."

    else

        echo "CloudWatch Agent is already installed."

    fi
}

configure_cloudwatch_agent(){

    local CONFIG_FILE="/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json"

    echo "Configuring CloudWatch Agent..."

    sudo mkdir -p "$(dirname "$CONFIG_FILE")"

    sudo tee "$CONFIG_FILE" > /dev/null <<EOF
{
    "agent": {
        "metrics_collection_interval": 60
    },
    "metrics": {
        "namespace": "CWAgent",
        "append_dimensions": {
            "InstanceId": "\${aws:InstanceId}"
        },
        "metrics_collected": {
            "mem": {
                "measurement": [
                    "mem_used_percent"
                ],
                "metrics_collection_interval": 60
            }
        }
    }
}
EOF

    echo "Starting/restarting CloudWatch Agent..."

    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
        -a fetch-config \
        -m ec2 \
        -c "file:$CONFIG_FILE" \
        -s

    echo "CloudWatch Agent configured successfully."
}

ensure_deps(){

    echo "Installing dependencies..."

    pwd
    ls -lah

    if npm ci --legacy-peer-deps --no-audit --no-fund; then
        echo "Dependencies installed successfully."
    else
        echo "Dependency installation failed. Please check the logs for details."
        exit 1
    fi

    echo "Rebuilding the application..."

    if npm run build; then
        echo "Build successful."
    else
        echo "Build failed. Please check the build logs for details."
        exit 1
    fi
}

pm2_startup(){

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

        if PORT="$PORT" pm2 start npm \
            --name "$APP_NAME" \
            --namespace "API-DT-4000" \
            -- run start; then

            echo "Application started successfully."

        else

            echo "Failed to start the application. Please check PM2 logs for details."
            exit 1

        fi
    fi

    pm2 startup
    pm2 save
}

cloudWatch_config(){

    echo "Configuring CloudWatch..."

    # -----------------------------------
    # Deployment Success Metric
    # -----------------------------------

    aws cloudwatch put-metric-data \
        --metric-name DeploySuccess \
        --namespace DevTweetBackend \
        --value 1 \
        --region "$REGION"

    echo "Deployment success metric sent."

    # -----------------------------------
    # CPU Alarm
    # -----------------------------------

    echo "Creating/updating CPU alarm..."

    aws cloudwatch put-metric-alarm \
        --alarm-name "${APP_NAME}-HighCPU" \
        --alarm-description "CPU utilization above 20% for 5 minutes" \
        --namespace AWS/EC2 \
        --metric-name CPUUtilization \
        --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
        --statistic Average \
        --period 60 \
        --threshold 20 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 5 \
        --datapoints-to-alarm 5 \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region "$REGION"

    echo "CPU alarm configured."

    # -----------------------------------
    # Memory Alarm
    # -----------------------------------

    echo "Creating/updating Memory alarm..."

    aws cloudwatch put-metric-alarm \
        --alarm-name "${APP_NAME}-HighMemory" \
        --alarm-description "Memory utilization above 20% for 5 minutes" \
        --namespace CWAgent \
        --metric-name mem_used_percent \
        --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
        --statistic Average \
        --period 60 \
        --threshold 20 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 5 \
        --datapoints-to-alarm 5 \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region "$REGION"

    echo "Memory alarm configured."

    echo "CloudWatch configuration completed."
}

# =======================================
# Deployment Flow
# =======================================

cleanup_space

fetch_git

ensure_needed

configure_cloudwatch_agent

ensure_deps

pm2_startup

cloudWatch_config

echo "======================================"
echo "Deployment of $APP_NAME completed successfully."
echo "======================================"