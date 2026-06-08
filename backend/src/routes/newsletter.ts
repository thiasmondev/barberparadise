import { Router, Request, Response } from "express";
import { brevoService } from "../services/brevoMarketingService";
import { prisma } from "../utils/prisma";

const router = Router();

/**
 * POST /api/newsletter/subscribe
 * Subscribe an email to the B2C newsletter list.
 */
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const rawEmail = req.body?.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email invalide" });
    }

    if (brevoService.isEnabled()) {
      try {
        await brevoService.subscribeToNewsletter(email);
      } catch (brevoError) {
        console.error("Brevo subscription error:", brevoError);
        return res.status(502).json({ error: "Impossible d’ajouter cet email à la newsletter pour le moment." });
      }
    }

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
      create: {
        email,
        subscribedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Successfully subscribed to newsletter",
    });
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return res.status(500).json({ error: "Failed to subscribe" });
  }
});

export default router;
