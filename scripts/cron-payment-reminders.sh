#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Render Cron Job — Relances paiement quotidiennes
#
# Ce script est exécuté par le service Render Cron Job "bp-payment-reminders".
# Il appelle la route backend POST /api/cron/payment-due-reminders.
#
# Variables d'environnement requises (définies dans le dashboard Render) :
#   BACKEND_URL  — URL complète du backend, ex: https://barberparadise-backend.onrender.com
#   CRON_SECRET  — Même valeur que sur le service barberparadise-backend
#
# Schedule : 0 7 * * * (07:00 UTC = 09:00 Europe/Paris en heure d'été)
#            0 8 * * * (08:00 UTC = 09:00 Europe/Paris en heure d'hiver)
#            → Ajuster manuellement lors des changements d'heure (mars/octobre)
#            → Ou laisser sur 07:00 UTC toute l'année (décalage d'1h en hiver, acceptable)
# ─────────────────────────────────────────────────────────────────────────────

set -e

if [ -z "$BACKEND_URL" ]; then
  echo "[ERROR] Variable BACKEND_URL non définie. Arrêt."
  exit 1
fi

if [ -z "$CRON_SECRET" ]; then
  echo "[ERROR] Variable CRON_SECRET non définie. Arrêt."
  exit 1
fi

TARGET_URL="${BACKEND_URL}/api/cron/payment-due-reminders"

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Déclenchement relances paiement → ${TARGET_URL}"

RESPONSE=$(curl \
  --silent \
  --show-error \
  --fail \
  --max-time 30 \
  --retry 2 \
  --retry-delay 5 \
  -X POST "${TARGET_URL}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -w "\n[HTTP_STATUS:%{http_code}]")

echo "$RESPONSE"
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Terminé."
