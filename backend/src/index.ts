// ============================================================
// BARBER PARADISE — API Backend Express + Prisma
// ============================================================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { productsRouter } from "./routes/products";
import { categoriesRouter } from "./routes/categories";
import { ordersRouter } from "./routes/orders";
import { customersRouter } from "./routes/customers";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { blogRouter } from "./routes/blog";

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
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
});

export default app;
