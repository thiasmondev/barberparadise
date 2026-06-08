import crypto from "crypto";
import { prisma } from "../utils/prisma";

export const API_KEY_PERMISSIONS = ["carousel", "hermes", "products", "orders", "admin"] as const;
export type ApiKeyPermission = typeof API_KEY_PERMISSIONS[number];

export interface ApiKeyAuthContext {
  type: "api_key";
  id: string;
  name: string;
  permissions: string[];
  isAdmin: boolean;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sanitizePermissions(permissions: string[]): string[] {
  const uniquePermissions = Array.from(new Set(permissions));
  return uniquePermissions.filter((permission) =>
    (API_KEY_PERMISSIONS as readonly string[]).includes(permission)
  );
}

class ApiKeyService {
  async createKey(params: {
    name: string;
    permissions: string[];
    expiresAt?: string | null;
    createdBy?: string;
  }) {
    const rawToken = `bp_live_${crypto.randomBytes(32).toString("hex")}`;
    const prefix = rawToken.substring(0, 16);
    const key = hashToken(rawToken);
    const permissions = sanitizePermissions(params.permissions);

    if (permissions.length === 0) {
      throw new Error("Au moins une permission valide est requise.");
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        name: params.name.trim(),
        key,
        prefix,
        permissions,
        expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
        createdBy: params.createdBy,
      },
      select: this.safeSelect(),
    });

    return { token: rawToken, apiKey };
  }

  async validateKey(token: string) {
    if (!token || !token.startsWith("bp_live_")) return null;

    const apiKey = await prisma.apiKey.findUnique({
      where: { key: hashToken(token) },
    });

    if (!apiKey) return null;
    if (!apiKey.isActive) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return apiKey;
  }

  hasPermission(auth: { permissions?: string[] } | null | undefined, permission: string): boolean {
    const permissions = auth?.permissions ?? [];
    return permissions.includes("admin") || permissions.includes(permission);
  }

  async listKeys() {
    return prisma.apiKey.findMany({
      select: this.safeSelect(),
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeKey(id: string) {
    return prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
      select: this.safeSelect(),
    });
  }

  async activateKey(id: string) {
    return prisma.apiKey.update({
      where: { id },
      data: { isActive: true },
      select: this.safeSelect(),
    });
  }

  async deleteKey(id: string) {
    return prisma.apiKey.delete({ where: { id } });
  }

  private safeSelect() {
    return {
      id: true,
      name: true,
      prefix: true,
      permissions: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}

const apiKeyService = new ApiKeyService();
export default apiKeyService;
