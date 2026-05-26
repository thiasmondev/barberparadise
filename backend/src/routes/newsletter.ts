import { Router, Request, Response } from "express";
import { brevoService } from "../services/brevoMarketingService";
import { prisma } from "../utils/prisma";

const router = Router();

/**
 * POST /api/newsletter/subscribe
 * Subscribe an email to the newsletter
 */
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email already exists in newsletter list
    const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existingSubscriber) {
      return res.status(400).json({ error: "Email already subscribed" });
    }

    // Add to database
    await prisma.newsletterSubscriber.create({
      data: {
        email,
        subscribedAt: new Date(),
      },
    });

    // Subscribe to Brevo if available
    if (brevoService.isEnabled()) {
      try {
        await brevoService.subscribeToNewsletter(email);
      } catch (brevoError) {
        console.error("Brevo subscription error:", brevoError);
        // Continue even if Brevo fails - user is still in our database
      }
    }

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
