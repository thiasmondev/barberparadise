import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import apiKeyService, { ApiKeyAuthContext } from "../services/apiKeyService";

export interface JwtAuthContext {
  type: "jwt";
  id: string;
  email: string;
  role?: string;
  isAdmin: boolean;
}

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role?: string };
  auth?: JwtAuthContext | ApiKeyAuthContext;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }
  try {
    // JWT_SECRET est garanti défini (validé au démarrage dans index.ts)
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string; role?: string };
    req.user = decoded;
    req.auth = {
      type: "jwt",
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      isAdmin: decoded.role === "admin" || decoded.role === "superadmin",
    };
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }

  if (token.startsWith("bp_live_")) {
    try {
      const apiKey = await apiKeyService.validateKey(token);
      if (!apiKey) {
        res.status(401).json({ error: "Clé API invalide ou expirée." });
        return;
      }

      req.auth = {
        type: "api_key",
        id: apiKey.id,
        name: apiKey.name,
        permissions: apiKey.permissions,
        isAdmin: apiKey.permissions.includes("admin"),
      };
      req.user = {
        id: apiKey.id,
        email: `${apiKey.name}@api-key.local`,
        role: req.auth.isAdmin ? "admin" : "service",
      };
      next();
      return;
    } catch {
      res.status(401).json({ error: "Clé API invalide ou expirée." });
      return;
    }
  }

  try {
    // ADMIN_JWT_SECRET est garanti défini (validé au démarrage dans index.ts)
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET as string) as { id: string; email: string; role: string };
    if (decoded.role !== "admin" && decoded.role !== "superadmin") {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    req.user = decoded;
    req.auth = {
      type: "jwt",
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      isAdmin: true,
    };
    next();
  } catch {
    res.status(401).json({ error: "Token admin invalide" });
  }
}

export function requireJwtAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }

  if (token.startsWith("bp_live_")) {
    res.status(403).json({ error: "Les clés API ne peuvent pas gérer les clés API." });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET as string) as { id: string; email: string; role: string };
    if (decoded.role !== "admin" && decoded.role !== "superadmin") {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    req.user = decoded;
    req.auth = {
      type: "jwt",
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      isAdmin: true,
    };
    next();
  } catch {
    res.status(401).json({ error: "Token admin invalide" });
  }
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    if (req.auth.type === "jwt" && req.auth.isAdmin) {
      next();
      return;
    }

    if (req.auth.type === "api_key" && apiKeyService.hasPermission(req.auth, permission)) {
      next();
      return;
    }

    res.status(403).json({ error: `Permission "${permission}" requise.` });
  };
}
