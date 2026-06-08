// ============================================================
// BARBER PARADISE — API Backend Express + Prisma
// ============================================================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ─── Validation des variables d'environnement critiques ──────
// Le serveur refuse de démarrer si une variable obligatoire est absente.
const REQUIRED_ENV = ["JWT_SECRET", "ADMIN_JWT_SECRET", "CORS_ORIGIN", "DATABASE_URL"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Variables d'environnement manquantes : ${missingEnv.join(", ")}`);
  console.error("Le serveur ne peut pas démarrer sans ces variables. Vérifiez votre configuration Render.");
  process.exit(1);
}

import { productsRouter } from "./routes/products";
import { categoriesRouter } from "./routes/categories";
import { ordersRouter } from "./routes/orders";
import { customersRouter } from "./routes/customers";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { blogRouter } from "./routes/blog";
import { seoRouter } from "./routes/seo";
import { adminMarketingRouter } from "./routes/admin-marketing";
import importReviewsRouter from "./routes/import-reviews";
import brandsRouter from "./routes/brands";
import { checkoutRouter } from "./routes/checkout";
import { webhooksRouter } from "./routes/webhooks";
import { proRouter } from "./routes/pro";
import { cronRouter } from "./routes/cron";
import newsletterRouter from "./routes/newsletter";
import { hermesRouter } from "./routes/hermes";
import { hermesDraftsRouter } from "./routes/hermes-drafts";
import { hermesCampaignsRouter } from "./routes/hermes-campaigns";
import { hermesImagesRouter } from "./routes/hermes-images";
import { hermesAnalyticsRouter } from "./routes/hermes-analytics";
import telegramRouter from "./routes/telegram";
import carouselRouter from "./routes/carousel";
import apiKeysRouter from "./routes/apiKeys";
import { requireJwtAdmin } from "./middleware/auth";
import telegramBotService from "./services/telegram/telegramBot";
import { registerTelegramHandlers } from "./services/telegram/telegramHandlers";
import { scheduleTelegramDailyDigest } from "./services/telegram/telegramDigest";
import { scheduleHermesAnalyticsCollection } from "./services/hermes/analyticsScheduler";

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────
// CORS strict — process.env.CORS_ORIGIN est garanti défini (validé ci-dessus)
app.use(cors({
  origin: process.env.CORS_ORIGIN as string,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes API ───────────────────────────────────────────────
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/admin/api-keys", requireJwtAdmin, apiKeysRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/blog", blogRouter);
app.use("/api/admin/seo", seoRouter);
app.use("/api/admin/marketing", adminMarketingRouter);
app.use("/api/admin/import-reviews", importReviewsRouter);
app.use("/api/brands", brandsRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/pro", proRouter);
app.use("/api/cron", cronRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/api/hermes", hermesRouter);
app.use("/api/hermes/drafts", hermesDraftsRouter);
app.use("/api/hermes/campaigns", hermesCampaignsRouter);
app.use("/api/hermes/images", hermesImagesRouter);
app.use("/api/hermes/analytics", hermesAnalyticsRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/carousel", carouselRouter);

// ─── Root & Health Check ─────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    name: "Barber Paradise API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      products: "/api/products",
      categories: "/api/categories",
      orders: "/api/orders",
      checkout: "/api/checkout/initiate",
      webhooks: "/api/webhooks/:provider",
      pro: "/api/pro",
      cron: "/api/cron/indy-report",
      auth: "/api/auth",
      blog: "/api/blog",
      admin: "/api/admin",
      marketing: "/api/admin/marketing",
              hermes: "/api/hermes",
              hermesDrafts: "/api/hermes/drafts",
              hermesCampaigns: "/api/hermes/campaigns",
              hermesImages: "/api/hermes/images",
              hermesAnalytics: "/api/hermes/analytics",
              telegram: "/api/telegram/status",
              carousel: "/api/carousel/active",
              apiKeys: "/api/admin/api-keys",

    },
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

// ─── 404 ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// ─── Error Handler ───────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

app.listen(PORT, () => {
  console.log(`✅ Barber Paradise API démarrée sur http://localhost:${PORT}`);
  console.log(`📊 Panel Admin: http://localhost:${PORT}/api/admin`);
  console.log(`🔒 CORS autorisé pour : ${process.env.CORS_ORIGIN}`);

  telegramBotService.initialize();
  registerTelegramHandlers();
  scheduleTelegramDailyDigest();
  scheduleHermesAnalyticsCollection();

  const publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
  if (publicUrl) {
    telegramBotService.setupWebhook(publicUrl).catch((error) => {
      console.error("[Telegram] Impossible de configurer le webhook Buzz:", error);
    });
  } else {
    console.warn("[Telegram] RENDER_EXTERNAL_URL/BACKEND_URL absent — webhook Buzz non configuré automatiquement.");
  }
});

export default app;
