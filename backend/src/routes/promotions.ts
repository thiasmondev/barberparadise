import express from "express";
import promotionService from "../services/promotionService";
import { requireAdmin } from "../middleware/auth";

const router = express.Router();

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  return String(value) === "true";
}

function parseInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getErrorMessage(error: unknown, fallback = "Erreur interne."): string {
  return error instanceof Error ? error.message : fallback;
}

router.post("/validate", async (req, res) => {
  try {
    const { code, cartTotal, cartItems, customerId, customerEmail, customerType, shipping } = req.body;
    if (!code || cartTotal === undefined || !Array.isArray(cartItems)) {
      return res.status(400).json({ valid: false, message: "code, cartTotal et cartItems sont requis." });
    }

    const result = await promotionService.validateCode({
      code: String(code),
      cartTotal: Number(cartTotal) || 0,
      cartItems,
      customerId,
      customerEmail,
      customerType: customerType === "b2b" ? "b2b" : "b2c",
      shipping: Number(shipping) || 0,
    });
    return res.json(result);
  } catch (error) {
    console.error("[Promotions] validate error", error);
    return res.status(500).json({ valid: false, message: "Erreur interne." });
  }
});

router.post("/automatic", async (req, res) => {
  try {
    const { cartTotal, cartItems, customerType, shipping } = req.body;
    if (cartTotal === undefined || !Array.isArray(cartItems)) {
      return res.status(400).json({ error: "cartTotal et cartItems sont requis." });
    }

    const discounts = await promotionService.getAutomaticDiscounts({
      cartTotal: Number(cartTotal) || 0,
      cartItems,
      customerType: customerType === "b2b" ? "b2b" : "b2c",
      shipping: Number(shipping) || 0,
    });
    return res.json(discounts);
  } catch (error) {
    console.error("[Promotions] automatic error", error);
    return res.status(500).json({ error: "Erreur interne." });
  }
});

router.use(requireAdmin);

router.get("/stats", async (_req, res) => {
  try {
    const stats = await promotionService.getStats();
    return res.json(stats);
  } catch (error) {
    console.error("[Promotions] stats error", error);
    return res.status(500).json({ error: "Erreur interne." });
  }
});

router.get("/", async (req, res) => {
  try {
    const { method, isActive, type, page, limit } = req.query;
    const result = await promotionService.list({
      method: typeof method === "string" && method !== "all" ? method : undefined,
      isActive: parseBoolean(isActive),
      type: typeof type === "string" && type !== "all" ? type : undefined,
      page: parseInteger(page, 1),
      limit: parseInteger(limit, 20),
    });
    return res.json(result);
  } catch (error) {
    console.error("[Promotions] list error", error);
    return res.status(500).json({ error: "Erreur interne." });
  }
});

router.post("/", async (req, res) => {
  try {
    const promo = await promotionService.create({ ...req.body, createdBy: "admin" });
    return res.status(201).json(promo);
  } catch (error: any) {
    console.error("[Promotions] create error", error);
    if (error?.code === "P2002") return res.status(400).json({ error: "Ce code promo existe déjà." });
    return res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.post("/record-usage", async (req, res) => {
  try {
    const { promotionId, orderId, customerId, customerEmail, discountAmount } = req.body;
    if (!promotionId || !orderId) return res.status(400).json({ error: "promotionId et orderId sont requis." });
    await promotionService.recordUsage({
      promotionId,
      orderId,
      customerId,
      customerEmail,
      discountAmount: Number(discountAmount) || 0,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("[Promotions] record usage error", error);
    return res.status(500).json({ error: "Erreur interne." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const promo = await promotionService.get(req.params.id);
    if (!promo) return res.status(404).json({ error: "Promotion non trouvée." });
    return res.json(promo);
  } catch (error) {
    console.error("[Promotions] get error", error);
    return res.status(500).json({ error: "Erreur interne." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const promo = await promotionService.update(req.params.id, req.body);
    return res.json(promo);
  } catch (error: any) {
    console.error("[Promotions] update error", error);
    if (error?.code === "P2002") return res.status(400).json({ error: "Ce code promo existe déjà." });
    return res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.patch("/:id/toggle", async (req, res) => {
  try {
    const promo = await promotionService.toggle(req.params.id);
    return res.json(promo);
  } catch (error) {
    console.error("[Promotions] toggle error", error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.post("/:id/duplicate", async (req, res) => {
  try {
    const promo = await promotionService.duplicate(req.params.id);
    return res.status(201).json(promo);
  } catch (error: any) {
    console.error("[Promotions] duplicate error", error);
    if (error?.code === "P2002") return res.status(400).json({ error: "Le code de copie existe déjà, réessayez." });
    return res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await promotionService.delete(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    console.error("[Promotions] delete error", error);
    return res.status(500).json({ error: "Erreur interne." });
  }
});

export default router;
