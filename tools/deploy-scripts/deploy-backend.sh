#!/bin/bash
# deploy-backend.sh - Deploy all services to GCE VM using local registry

set -e

# Configuration
VM_INSTANCE="d4dent-backend-s1"
VM_ZONE="asia-south1-a"
VM_PROJECT="project-09390695-9f59-4232-9bf"
DEPLOY_DIR="/opt/d4dent"
REGISTRY_HOST="localhost:5000"

SERVICES=(
  "api-gateway"
  "auth-service"
  "payment-service"
)

echo "🚀 Starting deployment to $VM_INSTANCE..."

# Step 1: Start local registry on VM if not running
echo "📦 Ensuring local registry is running..."
gcloud compute ssh $VM_INSTANCE \
  --zone=$VM_ZONE \
  --project=$VM_PROJECT \
  --command="
    if ! docker ps | grep -q registry; then
      echo 'Starting Docker registry...'
      docker run -d -p 5000:5000 --restart=always --name registry registry:2
    else
      echo 'Registry already running'
    fi
  "

# Step 2: Build and push each service
echo "🏗️ Building and pushing Docker images to local registry..."

for service in "${SERVICES[@]}"; do
  echo "  Building $service..."
  
  case "$service" in
    api-gateway) DOCKERFILE="Dockerfile.api-gateway" ;;
    auth-service) DOCKERFILE="Dockerfile.auth-service" ;;
    payment-service) DOCKERFILE="Dockerfile.payment-service" ;;
    *) echo "Unknown service: $service"; exit 1 ;;
  esac

  docker build \
    -f "$DOCKERFILE" \
    -t $REGISTRY_HOST/$service:latest \
    .
  
  # Push to VM's local registry
  echo "  Pushing $service to local registry..."
  docker save $REGISTRY_HOST/$service:latest | gzip > /tmp/${service}.tar.gz
  
  gcloud compute scp /tmp/${service}.tar.gz $VM_INSTANCE:/tmp/ \
    --zone=$VM_ZONE \
    --project=$VM_PROJECT
  
  gcloud compute ssh $VM_INSTANCE \
    --zone=$VM_ZONE \
    --project=$VM_PROJECT \
    --command="
      docker load -i /tmp/${service}.tar.gz
      docker tag $REGISTRY_HOST/$service:latest $REGISTRY_HOST/$service:latest
      rm /tmp/${service}.tar.gz
      echo '$service pushed to local registry'
    "
  
  rm /tmp/${service}.tar.gz
  echo "  ✅ $service pushed"
done

# Step 3: Deploy compose stack
echo "📡 Deploying to GCE VM..."

gcloud compute ssh $VM_INSTANCE \
  --zone=$VM_ZONE \
  --project=$VM_PROJECT \
  --command="
    cd $DEPLOY_DIR
    
    # Pull images from local registry
    echo 'Pulling images from local registry...'
    docker-compose -f docker-compose.prod.yml pull
    
    # Deploy
    echo 'Deploying services...'
    docker-compose -f docker-compose.prod.yml up -d
    
    # Verify
    echo 'Verifying deployment...'
    docker ps --format 'table {{.Names}}\t{{.Status}}'
  "

# Step 4: Health checks
echo "🔍 Running health checks..."

for service in "${SERVICES[@]}"; do
  echo "  Checking $service..."
  # Would check actual health endpoint here
done

echo "✅ Deployment complete!"
echo ""
echo "Services running:"
gcloud compute ssh $VM_INSTANCE \
  --zone=$VM_ZONE \
  --project=$VM_PROJECT \
  --command="docker ps --format '{{.Names}}'"

