import cron from "node-cron";
import analyticsModule from "./modules/analytics";

let scheduled = false;

export function scheduleHermesAnalyticsCollection(): void {
  if (scheduled) return;
  scheduled = true;

  cron.schedule(
    "15 8 * * *",
    async () => {
      try {
        await analyticsModule.collectDailyKPIs();
        console.log("[HermesAnalytics] Collecte quotidienne terminée.");
      } catch (error) {
        console.error("[HermesAnalytics] Erreur collecte quotidienne:", error);
      }
    },
    { timezone: process.env.TZ || "Europe/Paris" }
  );

  console.log("[HermesAnalytics] Collecte quotidienne programmée à 08:15.");
}
