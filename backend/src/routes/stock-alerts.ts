import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

export const stockAlertsRouter = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

stockAlertsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const productId = typeof req.body?.productId === "string" ? req.body.productId.trim() : "";
    const variantId = typeof req.body?.variantId === "string" && req.body.variantId.trim() ? req.body.variantId.trim() : null;

    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Email invalide" });
      return;
    }
    if (!productId) {
      res.status(400).json({ error: "Produit requis" });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      res.status(404).json({ error: "Produit introuvable" });
      return;
    }

    if (variantId) {
      const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
      if (!variant) {
        res.status(404).json({ error: "Variante introuvable pour ce produit" });
        return;
      }
    }

    const existing = await prisma.stockAlert.findFirst({
      where: { email, productId, variantId },
      select: { id: true },
    });
    if (existing) {
      res.status(200).json({ success: true, alreadySubscribed: true, message: "Vous êtes déjà inscrit pour cette alerte." });
      return;
    }

    await prisma.stockAlert.create({ data: { email, productId, variantId } });
    res.status(201).json({ success: true, alreadySubscribed: false, message: "Vous serez prévenu dès que cet article sera de nouveau disponible !" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(200).json({ success: true, alreadySubscribed: true, message: "Vous êtes déjà inscrit pour cette alerte." });
      return;
    }
    console.error("Erreur création alerte stock", error);
    res.status(500).json({ error: "Impossible de créer l’alerte stock pour le moment" });
  }
});
