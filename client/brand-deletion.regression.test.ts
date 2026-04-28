import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");
const readSource = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("suppression définitive des marques", () => {
  const adminRoutes = readSource("backend/src/routes/admin.ts");
  const adminApi = readSource("frontend/src/lib/admin-api.ts");
  const adminBrandsPage = readSource("frontend/src/app/admin/brands/page.tsx");
  const homePage = readSource("frontend/src/app/page.tsx");

  it("expose une route de statistiques avant suppression avec les compteurs demandés", () => {
    expect(adminRoutes).toContain('adminRouter.get("/brands/:id/stats"');
    expect(adminRoutes).toContain("select: { id: true, name: true, slug: true, logo: true }");
    expect(adminRoutes).toContain("productsCount: products.length");
    expect(adminRoutes).toContain("reviewsCount");
    expect(adminRoutes).toContain("imagesCount");
  });

  it("refuse la suppression sans confirm=true puis supprime les dépendances avant la marque", () => {
    expect(adminRoutes).toContain('adminRouter.delete("/brands/:id"');
    expect(adminRoutes).toContain('req.query.confirm !== "true"');
    expect(adminRoutes).toContain("res.status(400)");
    expect(adminRoutes).toContain("const result = await prisma.$transaction");

    const reviewDeleteIndex = adminRoutes.indexOf("tx.review.deleteMany");
    const variantDeleteIndex = adminRoutes.indexOf("tx.productVariant.deleteMany");
    const productDeleteIndex = adminRoutes.indexOf("tx.product.deleteMany");
    const brandDeleteIndex = adminRoutes.indexOf("tx.brand.delete");

    expect(reviewDeleteIndex).toBeGreaterThan(-1);
    expect(variantDeleteIndex).toBeGreaterThan(reviewDeleteIndex);
    expect(productDeleteIndex).toBeGreaterThan(variantDeleteIndex);
    expect(brandDeleteIndex).toBeGreaterThan(productDeleteIndex);
    expect(adminRoutes).toContain("productsDeleted: products.length");
    expect(adminRoutes).toContain("brandName: brand.name");
  });

  it("fournit les helpers frontend admin pour statistiques et suppression confirmée", () => {
    expect(adminApi).toContain("export interface AdminBrandStats");
    expect(adminApi).toContain("export function getAdminBrandStats");
    expect(adminApi).toContain("/api/admin/brands/${id}/stats");
    expect(adminApi).toContain("export function deleteAdminBrand");
    expect(adminApi).toContain("/api/admin/brands/${id}?confirm=true");
    expect(adminApi).toContain('method: "DELETE"');
  });

  it("uploade les médias de marque directement vers Cloudinary avant la sauvegarde de la marque", () => {
    expect(adminApi).toContain("async function uploadBrandMediaToCloudinary");
    expect(adminApi).toContain("CLOUDINARY_UPLOAD_PRESET");
    expect(adminApi).toContain("barberparadise_unsigned");
    expect(adminApi).toContain("https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload");
    expect(adminApi).toContain('formData.append("folder", "barberparadise/brands")');
    expect(adminApi).toContain("data.secure_url");
    expect(adminApi).not.toContain("/api/admin/brands/${id}/upload-logo");
    expect(adminApi).not.toContain("/api/admin/brands/${id}/upload-banner");
  });

  it("affiche une confirmation destructive avec saisie exacte du nom de marque", () => {
    expect(adminBrandsPage).toContain("function BrandDeleteModal");
    expect(adminBrandsPage).toContain("const canDelete = confirmName === stats.brand.name");
    expect(adminBrandsPage).toContain("disabled={!canDelete || deleting}");
    expect(adminBrandsPage).toContain("Supprimer définitivement");
    expect(adminBrandsPage).toContain("handleOpenDelete(brand)");
    expect(adminBrandsPage).toContain("getAdminBrandStats(brand.id)");
    expect(adminBrandsPage).toContain("deleteAdminBrand(stats.brand.id)");
    expect(adminBrandsPage).toContain("La marque ${result.brandName} et ses ${result.productsDeleted} produits ont été supprimés définitivement");
  });

  it("charge dynamiquement le carousel des marques de la page d’accueil via GET /api/brands", () => {
    expect(homePage).not.toContain("REAL_BRANDS");
    expect(homePage).toContain("getBrands");
    expect(homePage).toContain("setBrands(brandsData.filter((brand) => brand.productCount > 0))");
    expect(homePage).toContain("brands.map((brand) =>");
    expect(homePage).toContain("/marques/${brand.slug}");
  });
});
