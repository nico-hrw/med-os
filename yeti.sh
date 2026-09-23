#!/bin/bash

# =================================================================
# MedOS Yeti Management Script (PM2 & Node 20 Edition)
# =================================================================

export PATH="/root/.nvm/versions/node/v20.20.2/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
FRONTEND_DIR="$ROOT_DIR/apps/frontend"

echo "🔄 Prüfe auf Code-Updates..."
cd "$ROOT_DIR" || exit 1
git checkout -- . 2>/dev/null || true
git pull origin main

cleanup() {
    echo "🧹 Räume alte Yeti-Prozesse auf..."
    pm2 delete yeti-backend yeti-frontend 2>/dev/null
    fuser -k 4000/tcp 2>/dev/null
    fuser -k 5173/tcp 2>/dev/null
    sleep 1
}

install_deps() {
    echo "📦 Installiere Backend-Abhängigkeiten..."
    cd "$BACKEND_DIR" && npm install
    echo "📦 Installiere Frontend-Abhängigkeiten..."
    cd "$FRONTEND_DIR" && npm install
    cd "$ROOT_DIR"
}

build_frontend() {
    echo "🏗️ Baue Frontend..."
    cd "$FRONTEND_DIR" || exit 1
    npm run build
    cd "$ROOT_DIR"
}

start_backend() {
    echo "🚀 Starte medOS Backend via PM2..."
    cd "$BACKEND_DIR" || exit 1
    pm2 start "npm run dev" --name "yeti-backend"
    pm2 save
    echo "✅ Backend aktiv (Port 4000)"
}

start_frontend() {
    echo "🚀 Starte medOS Frontend (Production Preview) via PM2..."
    cd "$FRONTEND_DIR" || exit 1
    pm2 start "npm run preview" --name "yeti-frontend"
    pm2 save
    echo "✅ Frontend aktiv (Port 5173)"
}

start_all() {
    start_backend
    start_frontend
    echo "------------------------------------------------------"
    echo "🎉 medOS Yeti ist online unter https://go-tide.app/yeti/ !"
    echo "👉 Logs:   pm2 logs yeti-backend yeti-frontend"
    echo "👉 Status: pm2 status"
    echo "------------------------------------------------------"
}

case "$1" in
    -a|--all|"")
        cleanup
        install_deps
        build_frontend
        start_all
        ;;
    -b|--backend)
        pm2 delete yeti-backend 2>/dev/null
        fuser -k 4000/tcp 2>/dev/null
        cd "$BACKEND_DIR" && npm install
        start_backend
        ;;
    -f|--frontend)
        pm2 delete yeti-frontend 2>/dev/null
        fuser -k 5173/tcp 2>/dev/null
        cd "$FRONTEND_DIR" && npm install && npm run build
        start_frontend
        ;;
    -s|--start)
        cleanup
        start_all
        ;;
    -k|--stop)
        cleanup
        echo "🛑 medOS Yeti gestoppt."
        ;;
    status)
        pm2 status
        ;;
    logs)
        pm2 logs yeti-backend yeti-frontend
        ;;
    *)
        echo "Verwendung: ./yeti.sh [-a | -b | -f | -s | -k | status | logs]"
        echo "  -a, --all      : Code pullen, Abhängigkeiten installieren, bauen & neu starten"
        echo "  -b, --backend  : Nur Backend aktualisieren und starten"
        echo "  -f, --frontend : Nur Frontend aktualisieren, bauen und starten"
        echo "  -s, --start    : Prozesse neu starten (ohne npm install/build)"
        echo "  -k, --stop     : Prozesse stoppen"
        echo "  status         : PM2 Status anzeigen"
        echo "  logs           : Live-Logs anzeigen"
        exit 1
        ;;
esac
