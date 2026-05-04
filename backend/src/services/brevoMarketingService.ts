type BrevoRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

export type BrevoStatus = {
  configured: boolean;
  message: string;
};

const BREVO_BASE_URL = "https://api.brevo.com/v3";

export const BREVO_LISTS = {
  b2c: 5,
  b2b: 6,
  inactive: 7,
} as const;

function brevoHeaders() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return null;
  return {
    "api-key": apiKey,
    "accept": "application/json",
    "content-type": "application/json",
  };
}

export function getBrevoStatus(): BrevoStatus {
  const configured = Boolean(process.env.BREVO_API_KEY);
  return {
    configured,
    message: configured
      ? "Brevo est configuré côté backend."
      : "BREVO_API_KEY est absente. Ajoutez-la dans les variables d'environnement Render du backend pour activer les envois réels.",
  };
}

async function brevoRequest<T>(path: string, options: BrevoRequestOptions = {}): Promise<T> {
  const headers = brevoHeaders();
  if (!headers) {
    throw new Error("BREVO_API_KEY absente : configurez cette variable dans Render avant d'utiliser Brevo.");
  }

  const response = await fetch(`${BREVO_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.error || `Erreur Brevo ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function listBrevoLists(): Promise<Array<{ id: number; name: string; totalSubscribers?: number }>> {
  const payload = await brevoRequest<{ lists?: Array<{ id: number; name: string; totalSubscribers?: number }> }>("/contacts/lists?limit=50&offset=0");
  return payload.lists || [];
}

export async function upsertBrevoContact(args: {
  email: string;
  firstName?: string;
  lastName?: string;
  listIds?: number[];
}) {
  return brevoRequest<{ id?: number }>("/contacts", {
    method: "POST",
    body: {
      email: args.email,
      attributes: {
        PRENOM: args.firstName || "",
        NOM: args.lastName || "",
      },
      listIds: args.listIds?.length ? args.listIds : undefined,
      updateEnabled: true,
    },
  });
}

export async function createBrevoEmailCampaign(args: {
  name: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  htmlContent: string;
  listIds: number[];
  scheduledAt?: Date | null;
}) {
  const body: Record<string, unknown> = {
    name: args.name,
    subject: args.subject,
    sender: { name: args.senderName, email: args.senderEmail },
    htmlContent: args.htmlContent,
    recipients: { listIds: args.listIds },
  };

  if (args.scheduledAt) {
    body.scheduledAt = args.scheduledAt.toISOString();
  }

  return brevoRequest<{ id: number }>("/emailCampaigns", {
    method: "POST",
    body,
  });
}

export async function sendBrevoCampaignNow(campaignId: number) {
  return brevoRequest(`/emailCampaigns/${campaignId}/sendNow`, { method: "POST" });
}
