import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role?: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }
  try {
    // JWT_SECRET est garanti défini (validé au démarrage dans index.ts)
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Token manquant" });
    return;
  }
  try {
    // ADMIN_JWT_SECRET est garanti défini (validé au démarrage dans index.ts)
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET as string) as { id: string; email: string; role: string };
    if (decoded.role !== "admin" && decoded.role !== "superadmin") {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token admin invalide" });
  }
}
