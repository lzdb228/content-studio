#!/bin/bash
# 部署到 47.98.184.248:8889 /opt/prototypes/
set -e

HOST="47.98.184.248"
KEY="/tmp/xinghe_deploy_key"
PORT="8889"
ROOT="/opt/prototypes"

echo "=== 1. Build ==="
cd "$(dirname "$0")"
NODE_ENV=development npx vite build

echo "=== 2. Upload ==="
tar czf /tmp/p-deploy.tar.gz -C dist .
scp -i "$KEY" /tmp/p-deploy.tar.gz root@$HOST:/tmp/

echo "=== 3. Extract ==="
ssh -i "$KEY" root@$HOST "
  cd $ROOT/content-studio
  rm -rf assets index.html
  tar xzf /tmp/p-deploy.tar.gz
  rm /tmp/p-deploy.tar.gz
  echo '  files deployed:'
  ls -la
"

echo "=== 4. Done ==="
echo "  Portal:  http://$HOST:$PORT/"
echo "  Studio:  http://$HOST:$PORT/content-studio/"
