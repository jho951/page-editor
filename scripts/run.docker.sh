#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
BUILD_COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.build.yml"
DEV_COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.dev.yml"
PROD_COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.prod.yml"

MODE="${1:-dev}"
ACTION="${2:-up}"

case "$MODE" in
  dev)
    PROJECT_NAME="editor-page-dev"
    COMPOSE_FILES=(-f "$BASE_COMPOSE_FILE" -f "$DEV_COMPOSE_FILE")
    BUILD_FILES=(-f "$BASE_COMPOSE_FILE" -f "$DEV_COMPOSE_FILE")
    SERVICE="editor"
    ;;
  prod)
    PROJECT_NAME="editor-page-prod"
    COMPOSE_FILES=(-f "$BASE_COMPOSE_FILE" -f "$PROD_COMPOSE_FILE")
    BUILD_FILES=(-f "$BASE_COMPOSE_FILE" -f "$BUILD_COMPOSE_FILE")
    SERVICE="editor"
    ;;
  *)
    echo "Usage: $0 [dev|prod] [up|down|build|logs|restart|ps]"
    exit 1
    ;;
esac

compose() {
  docker compose -p "$PROJECT_NAME" "${COMPOSE_FILES[@]}" "$@"
}

build_compose() {
  docker compose -p "$PROJECT_NAME" "${BUILD_FILES[@]}" "$@"
}

case "$ACTION" in
  up)
    if [[ "$MODE" == "dev" ]]; then
      compose up --build --detach --remove-orphans "$SERVICE"
    else
      compose pull "$SERVICE"
      compose up --detach --remove-orphans "$SERVICE"
    fi
    ;;
  down)
    compose down --remove-orphans
    ;;
  build)
    build_compose build "$SERVICE"
    ;;
  logs)
    compose logs -f "$SERVICE"
    ;;
  restart)
    compose restart "$SERVICE"
    ;;
  ps)
    compose ps
    ;;
  *)
    echo "Usage: $0 [dev|prod] [up|down|build|logs|restart|ps]"
    exit 1
    ;;
esac
