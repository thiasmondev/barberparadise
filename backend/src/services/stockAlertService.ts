import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../utils/prisma";
import { sendStockAlertEmail } from "./emailService";

const EMAIL_RATE_LIMIT_PER_MINUTE = 50;
const RATE_LIMIT_WINDOW_MS = 60_000;

type PrismaTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

type NotifyStockAlertOptions = {
  productId: string;
  variantId?: string | null;
  force?: boolean;
};

type StockAlertResult = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
};

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "https://barberparadise.fr").replace(/\/$/, "");
}

function parseImages(images: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(images || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  } catch {
    return [];
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function notifyStockAlerts(
  options: NotifyStockAlertOptions,
  db: PrismaTx = defaultPrisma
): Promise<StockAlertResult> {
  const product = await db.product.findUnique({
    where: { id: options.productId },
    select: { id: true, name: true, slug: true, price: true, images: true },
  });

  if (!product) return { attempted: 0, sent: 0, skipped: 0, failed: 0 };

  const alerts = await db.stockAlert.findMany({
    where: {
      productId: options.productId,
      variantId: options.variantId ?? null,
      ...(options.force ? {} : { notified: false }),
    },
    orderBy: { createdAt: "asc" },
  });

  const images = parseImages(product.images);
  const productUrl = `${getFrontendUrl()}/produit/${product.slug}`;
  const result: StockAlertResult = { attempted: alerts.length, sent: 0, skipped: 0, failed: 0 };

  for (let index = 0; index < alerts.length; index += 1) {
    if (index > 0 && index % EMAIL_RATE_LIMIT_PER_MINUTE === 0) {
      await wait(RATE_LIMIT_WINDOW_MS);
    }

    const alert = alerts[index];
    if (alert.notified && !options.force) {
      result.skipped += 1;
      continue;
    }

    const emailResult = await sendStockAlertEmail({
      to: alert.email,
      productName: product.name,
      productPrice: product.price,
      productImage: images[0] || null,
      productUrl,
    });

    if (emailResult.sent) {
      await db.stockAlert.update({
        where: { id: alert.id },
        data: { notified: true, notifiedAt: new Date() },
      });
      result.sent += 1;
    } else if (emailResult.skipped) {
      result.skipped += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

export async function notifyIfRestocked(params: {
  productId: string;
  variantId?: string | null;
  previousStock: number;
  nextStock: number;
}): Promise<StockAlertResult> {
  if (params.previousStock === 0 && params.nextStock > 0) {
    return notifyStockAlerts({ productId: params.productId, variantId: params.variantId ?? null });
  }
  return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
}


export async function notifySingleStockAlert(alertId: string): Promise<StockAlertResult> {
  const alert = await defaultPrisma.stockAlert.findUnique({
    where: { id: alertId },
    include: {
      product: { select: { id: true, name: true, slug: true, price: true, images: true } },
    },
  });

  if (!alert || alert.notified) return { attempted: alert ? 1 : 0, sent: 0, skipped: alert ? 1 : 0, failed: 0 };

  const images = parseImages(alert.product.images);
  const productUrl = `${getFrontendUrl()}/produit/${alert.product.slug}`;
  const emailResult = await sendStockAlertEmail({
    to: alert.email,
    productName: alert.product.name,
    productPrice: alert.product.price,
    productImage: images[0] || null,
    productUrl,
  });

  if (emailResult.sent) {
    await defaultPrisma.stockAlert.update({
      where: { id: alert.id },
      data: { notified: true, notifiedAt: new Date() },
    });
    return { attempted: 1, sent: 1, skipped: 0, failed: 0 };
  }

  if (emailResult.skipped) {
    return { attempted: 1, sent: 0, skipped: 1, failed: 0 };
  }

  return { attempted: 1, sent: 0, skipped: 0, failed: 1 };
}
