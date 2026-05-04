import { readFileSync, writeFileSync } from 'node:fs';

const schemaPath = '/home/ubuntu/barberparadise/backend/prisma/schema.prisma';
let schema = readFileSync(schemaPath, 'utf8');

schema = schema.replace(
  /model Order \{([\s\S]*?)\n\}/,
  (match, body) => {
    if (body.includes('promoCodeId')) return match;
    const updated = body.replace(
      '  proInvoiceUrl     String?\n  notes             String?',
      '  proInvoiceUrl     String?\n  promoCodeId       String?\n  discountAmount    Float    @default(0)\n  notes             String?'
    ).replace(
      '  shipment        Shipment?',
      '  shipment        Shipment?\n  promoCode       PromoCode?       @relation(fields: [promoCodeId], references: [id])'
    ).replace(
      '  @@index([customerId])',
      '  @@index([customerId])\n  @@index([promoCodeId])'
    );
    return `model Order {${updated}\n}`;
  }
);

const marketingModels = `model MarketingCampaign {
  id              String          @id @default(cuid())
  title           String
  slug            String          @unique
  type            String
  objective       String
  audience        String
  status          String          @default("draft")
  tone            String          @default("expert")
  channels        String[]        @default([])
  productIds      String[]        @default([])
  content         Json?
  generatedAssets Json?
  startsAt        DateTime?
  endsAt          DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  emailCampaigns  EmailCampaign[]
  promoCodes      PromoCode[]
  blogPosts       BlogPost[]
  @@index([status])
  @@index([type])
}

model PromoCode {
  id          String             @id @default(cuid())
  code        String             @unique
  label       String
  description String?
  type        String
  value       Float
  minAmount   Float?
  maxUses     Int?
  usedCount   Int                @default(0)
  startsAt    DateTime?
  endsAt      DateTime?
  active      Boolean            @default(true)
  campaignId  String?
  campaign    MarketingCampaign? @relation(fields: [campaignId], references: [id])
  orders      Order[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  @@index([active])
  @@index([campaignId])
}

model EmailCampaign {
  id              String             @id @default(cuid())
  campaignId      String?
  campaign        MarketingCampaign? @relation(fields: [campaignId], references: [id])
  name            String
  subject         String
  preheader       String?
  htmlContent     String
  textContent     String?
  senderName      String?
  senderEmail     String?
  brevoCampaignId Int?
  brevoListId     Int?
  segment         String?
  status          String             @default("draft")
  scheduledAt     DateTime?
  sentAt          DateTime?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  @@index([status])
  @@index([campaignId])
}

model BlogPost {
  id              String             @id @default(cuid())
  slug            String             @unique
  title           String
  excerpt         String
  content         String
  coverImage      String?
  categorySlug    String
  tags            String[]           @default([])
  metaTitle       String?
  metaDescription String?
  status          String             @default("draft")
  publishedAt     DateTime?
  campaignId      String?
  campaign        MarketingCampaign? @relation(fields: [campaignId], references: [id])
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  @@index([status])
  @@index([categorySlug])
  @@index([campaignId])
}

model MarketingSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;

schema = schema.replace(/model BlogPost \{[\s\S]*?\n\}\n?/, `${marketingModels}\n`);

writeFileSync(schemaPath, schema);
