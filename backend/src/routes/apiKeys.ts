import express, { Request, Response } from "express";
import apiKeyService, { API_KEY_PERMISSIONS } from "../services/apiKeyService";
import { AuthRequest } from "../middleware/auth";

const router = express.Router();

function normalizePermissions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const permissions = value.filter((permission): permission is string => typeof permission === "string");
  const sanitized = permissions.filter((permission) => (API_KEY_PERMISSIONS as readonly string[]).includes(permission));
  return Array.from(new Set(sanitized));
}

function normalizeExpiresAt(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return value;
}

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const keys = await apiKeyService.listKeys();
    res.json({ keys });
  } catch (error) {
    console.error("[ApiKeys] Erreur liste:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as { name?: unknown; permissions?: unknown; expiresAt?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const permissions = normalizePermissions(body.permissions);
    const expiresAt = normalizeExpiresAt(body.expiresAt);

    if (!name || !permissions || permissions.length === 0) {
      res.status(400).json({
        error: "name (string) et permissions (string[]) sont requis.",
        validPermissions: API_KEY_PERMISSIONS,
      });
      return;
    }

    if (body.expiresAt !== undefined && expiresAt === undefined) {
      res.status(400).json({ error: "expiresAt doit être une date ISO valide ou null." });
      return;
    }

    const result = await apiKeyService.createKey({
      name,
      permissions,
      expiresAt,
      createdBy: req.auth?.id,
    });

    res.status(201).json({
      message: "Clé API créée. Copiez le token maintenant : il ne sera plus jamais affiché.",
      token: result.token,
      apiKey: result.apiKey,
    });
  } catch (error) {
    console.error("[ApiKeys] Erreur création:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur interne." });
  }
});

router.patch("/:id/revoke", async (req: Request, res: Response): Promise<void> => {
  try {
    const key = await apiKeyService.revokeKey(req.params.id);
    res.json({ success: true, message: `Clé "${key.name}" révoquée.`, apiKey: key });
  } catch (error) {
    console.error("[ApiKeys] Erreur révocation:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.patch("/:id/activate", async (req: Request, res: Response): Promise<void> => {
  try {
    const key = await apiKeyService.activateKey(req.params.id);
    res.json({ success: true, message: `Clé "${key.name}" réactivée.`, apiKey: key });
  } catch (error) {
    console.error("[ApiKeys] Erreur réactivation:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    await apiKeyService.deleteKey(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[ApiKeys] Erreur suppression:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

export default router;
