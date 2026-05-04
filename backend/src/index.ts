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
import importReviewsRouter from "./routes/import-reviews";
import brandsRouter from "./routes/brands";
import { checkoutRouter } from "./routes/checkout";
import { webhooksRouter } from "./routes/webhooks";
import { proRouter } from "./routes/pro";
import { cronRouter } from "./routes/cron";

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
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/blog", blogRouter);
app.use("/api/admin/seo", seoRouter);
app.use("/api/admin/import-reviews", importReviewsRouter);
app.use("/api/brands", brandsRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/pro", proRouter);
app.use("/api/cron", cronRouter);

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
});

export default app;
