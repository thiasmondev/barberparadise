#!/usr/bin/env node
/**
 * Render Cron Job — Relances paiement quotidiennes
 *
 * Appelle POST /api/cron/payment-due-reminders sur le backend Barber Paradise.
 * Utilise fetch natif (Node >= 18). Aucune dépendance externe.
 *
 * Variables d'environnement requises :
 *   BACKEND_URL   — ex: https://barberparadise-backend.onrender.com
 *   CRON_SECRET   — même valeur que sur le service barberparadise-backend
 *
 * Codes de sortie :
 *   0 — succès (réponse HTTP 2xx)
 *   1 — échec (erreur réseau, timeout, ou réponse HTTP hors 2xx)
 */

const BACKEND_URL = process.env.BACKEND_URL;
const CRON_SECRET = process.env.CRON_SECRET;

function ts() {
  return new Date().toISOString();
}

async function main() {
  if (!BACKEND_URL) {
    console.error(`[${ts()}] [ERROR] Variable BACKEND_URL non définie.`);
    process.exit(1);
  }
  if (!CRON_SECRET) {
    console.error(`[${ts()}] [ERROR] Variable CRON_SECRET non définie.`);
    process.exit(1);
  }

  const url = `${BACKEND_URL}/api/cron/payment-due-reminders`;
  console.log(`[${ts()}] Déclenchement relances paiement → ${url}`);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error(`[${ts()}] [ERROR] Échec réseau :`, err.message || err);
    process.exit(1);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => "(corps illisible)");
  }

  const statusLabel = response.ok ? "OK" : "ERREUR";
  console.log(`[${ts()}] [${statusLabel}] HTTP ${response.status} — Réponse :`, JSON.stringify(body));

  if (!response.ok) {
    console.error(`[${ts()}] [ERROR] Le backend a retourné un statut d'erreur (${response.status}). Vérifier les logs du service barberparadise-backend.`);
    process.exit(1);
  }

  console.log(`[${ts()}] Terminé avec succès.`);
  process.exit(0);
}

main();
