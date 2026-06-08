-- CreateTable
CREATE TABLE "CarouselSlide" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageMobileUrl" TEXT,
    "imageAlt" TEXT,
    "cloudinaryId" TEXT,
    "mobileCloudinaryId" TEXT,
    "ctaText" TEXT,
    "ctaLink" TEXT,
    "ctaStyle" TEXT DEFAULT 'primary',
    "textPosition" TEXT NOT NULL DEFAULT 'left',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "overlayOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarouselSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarouselSlide_isActive_idx" ON "CarouselSlide"("isActive");

-- CreateIndex
CREATE INDEX "CarouselSlide_position_idx" ON "CarouselSlide"("position");

-- CreateIndex
CREATE INDEX "CarouselSlide_startDate_endDate_idx" ON "CarouselSlide"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "CarouselSlide_category_idx" ON "CarouselSlide"("category");
