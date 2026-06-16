-- CreateTable: BlogArticle
CREATE TABLE "BlogArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "readTime" INTEGER NOT NULL DEFAULT 1,
    "seoMetaTitle" TEXT,
    "seoMetaDescription" TEXT,
    "seoKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "linkedProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourceDraftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticle_slug_key" ON "BlogArticle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticle_sourceDraftId_key" ON "BlogArticle"("sourceDraftId");

-- CreateIndex
CREATE INDEX "BlogArticle_status_idx" ON "BlogArticle"("status");

-- CreateIndex
CREATE INDEX "BlogArticle_category_idx" ON "BlogArticle"("category");

-- CreateIndex
CREATE INDEX "BlogArticle_publishedAt_idx" ON "BlogArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "BlogArticle_createdAt_idx" ON "BlogArticle"("createdAt");

-- AddForeignKey
ALTER TABLE "BlogArticle" ADD CONSTRAINT "BlogArticle_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "ContentDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
