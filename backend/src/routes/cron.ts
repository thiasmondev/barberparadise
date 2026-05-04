import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { sendEmail } from "../services/emailService";
import {
  buildIndyCsv,
  buildIndyEmailHtml,
  buildIndyReport,
  IndyReport,
  previousMonthKey,
} from "../services/indyReportService";

export const cronRouter = Router();

const anthropicForIndy = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function isCronAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = req.header("x-cron-secret");
  return bearer === expected || headerSecret === expected;
}

function getFinanceRecipient(): string {
  if (process.env.FINANCE_EMAIL) return process.env.FINANCE_EMAIL;
  if (process.env.ADMIN_EMAIL) return process.env.ADMIN_EMAIL;
  return "contact@barberparadise.fr";
}

async function generateIndyCfoAnalysis(report: IndyReport): Promise<string> {
  if (!anthropicForIndy) {
    return "Analyse CFO indisponible : clé ANTHROPIC_API_KEY absente. Vérifier manuellement le CA, la TVA, les PSP, les lignes OSS et les remboursements avant clôture Indy.";
  }

  try {
    const message = await anthropicForIndy.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: `Tu es CFO e-commerce pour Barber Paradise. Analyse ce bilan mensuel Indy en français, en 5 points opérationnels maximum : cohérence CA/TVA, concentration PSP, répartition OSS pays/TVA, remboursements/annulations, points à vérifier avant clôture Indy. Ne produis pas de tableau. Données JSON : ${JSON.stringify(report).slice(0, 20000)}`,
        },
      ],
    });
    const textBlock = message.content.find(block => block.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text.trim() : "Analyse CFO indisponible.";
  } catch (error) {
    console.error("[cron-indy-report] Analyse CFO Claude impossible", error);
    return "Analyse CFO indisponible : génération Claude en échec. Vérifier manuellement le CA, la TVA, les PSP et les remboursements avant clôture Indy.";
  }
}

cronRouter.post("/indy-report", async (req: Request, res: Response): Promise<void> => {
  if (!isCronAuthorized(req)) {
    res.status(401).json({ error: "Cron non autorisé" });
    return;
  }

  try {
    const month = typeof req.body?.month === "string" && req.body.month.trim()
      ? req.body.month.trim()
      : previousMonthKey();
    const report = await buildIndyReport(month);
    const cfoAnalysis = await generateIndyCfoAnalysis(report);
    const csv = buildIndyCsv(report);
    const to = getFinanceRecipient();
    const emailResult = await sendEmail({
      to,
      subject: `Bilan mensuel Indy Barber Paradise — ${report.month}`,
      html: buildIndyEmailHtml(report, cfoAnalysis),
      attachments: [
        {
          filename: `barberparadise-indy-${report.month}.csv`,
          content: Buffer.from(csv, "utf8").toString("base64"),
        },
      ],
    });

    res.json({
      ok: true,
      sent: emailResult.sent,
      skipped: emailResult.skipped || false,
      id: emailResult.id,
      month: report.month,
      to,
    });
  } catch (error) {
    console.error("[cron-indy-report] Envoi impossible", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Envoi cron Indy impossible" });
  }
});
