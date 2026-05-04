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
    expect(adminRoutes).toContain('adminRouter.get(\n  "/brands/:id/stats"');
    expect(adminRoutes).toContain("select: { id: true, name: true, slug: true, logo: true }");
    expect(adminRoutes).toContain("productsCount: products.length");
    expect(adminRoutes).toContain("reviewsCount");
    expect(adminRoutes).toContain("imagesCount");
  });

  it("refuse la suppression sans confirm=true puis supprime les dépendances avant la marque", () => {
    expect(adminRoutes).toContain('adminRouter.delete(\n  "/brands/:id"');
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

describe("agent SEO produit depuis URL", () => {
  const seoRoutes = readSource("backend/src/routes/seo.ts");
  const seoAgent = readSource("backend/src/services/seo-agent.ts");
  const adminApi = readSource("frontend/src/lib/admin-api.ts");
  const seoProductPage = readSource("frontend/src/app/admin/seo/produit/page.tsx");
  const seoDashboardPage = readSource("frontend/src/app/admin/seo/page.tsx");

  it("expose un générateur de brouillon produit depuis URL et une création de produit inactif", () => {
    expect(seoAgent).toContain("export async function generateProductDraftFromUrl");
    expect(seoAgent).toContain("imageUrls");
    expect(seoAgent).toContain("schemaJsonLd");
    expect(seoAgent).toContain("faqItems");
    expect(seoRoutes).toContain('seoRouter.post("/product-url/draft"');
    expect(seoRoutes).toContain('seoRouter.post("/product-url/create"');
    expect(seoRoutes).toContain('status: "draft"');
  });

  it("fournit les appels API et l’interface de création depuis une URL de marque", () => {
    expect(adminApi).toContain("export function generateProductDraftFromUrl");
    expect(adminApi).toContain("export function createProductFromUrlDraft");
    expect(seoProductPage).toContain("Créer un nouveau produit depuis une URL");
    expect(seoProductPage).toContain("handleGenerateProductFromUrl");
    expect(seoProductPage).toContain("handleCreateProductFromUrlDraft");
    expect(seoDashboardPage).toContain("Créer depuis une URL");
  });
});

describe("authentification client frontend", () => {
  const customerApi = readSource("frontend/src/lib/customer-api.ts");
  const customerContext = readSource("frontend/src/contexts/CustomerAuthContext.tsx");
  const clientLayout = readSource("frontend/src/components/ClientLayout.tsx");
  const connexionPage = readSource("frontend/src/app/connexion/page.tsx");
  const inscriptionPage = readSource("frontend/src/app/inscription/page.tsx");
  const comptePage = readSource("frontend/src/app/compte/page.tsx");
  const header = readSource("frontend/src/components/Header.tsx");
  const customerRoutes = readSource("backend/src/routes/customers.ts");

  it("centralise les appels API client avec JWT localStorage et hydratation /api/customers/me", () => {
    expect(customerApi).toContain('CUSTOMER_TOKEN_KEY = "bp_customer_token"');
    expect(customerApi).toContain('"/api/auth/login"');
    expect(customerApi).toContain('"/api/auth/register"');
    expect(customerApi).toContain('"/api/customers/me"');
    expect(customerApi).toContain('headers.set("Authorization", `Bearer ${authToken}`)');
    expect(customerContext).toContain("interface CustomerAuthContextValue");
    expect(customerContext).toContain("localStorage.setItem(CUSTOMER_TOKEN_KEY, response.token)");
    expect(customerContext).toContain("getCustomerMe(token)");
    expect(customerContext).toContain("localStorage.removeItem(CUSTOMER_TOKEN_KEY)");
    expect(clientLayout).toContain("<CustomerAuthProvider>");
  });

  it("crée les pages connexion et inscription avec validations et redirection vers /compte", () => {
    expect(connexionPage).toContain('const redirectTo = searchParams.get("redirect") || "/compte"');
    expect(connexionPage).toContain("router.replace(redirectTo)");
    expect(connexionPage).toContain("login(email.trim().toLowerCase(), password)");
    expect(connexionPage).toContain("Veuillez saisir une adresse email valide.");
    expect(connexionPage).toContain("Pas encore de compte ?");
    expect(connexionPage).toContain('href="/inscription"');
    expect(inscriptionPage).toContain('router.replace("/compte")');
    expect(inscriptionPage).toContain("register({");
    expect(inscriptionPage).toContain("Le mot de passe doit contenir au moins 8 caractères");
    expect(inscriptionPage).toContain("La confirmation du mot de passe ne correspond pas.");
    expect(inscriptionPage).toContain("Déjà un compte ?");
    expect(inscriptionPage).toContain('href="/connexion"');
  });

  it("protège /compte et connecte informations, commandes, adresses et wishlist", () => {
    expect(comptePage).toContain('router.replace("/connexion")');
    expect(comptePage).toContain("getCustomerOrders()");
    expect(comptePage).toContain("getCustomerAddresses()");
    expect(comptePage).toContain("createCustomerAddress");
    expect(comptePage).toContain("deleteCustomerAddress");
    expect(comptePage).toContain("getCustomerWishlist()");
    expect(comptePage).toContain("removeCustomerWishlist");
    expect(comptePage).toContain("Mes informations");
    expect(comptePage).toContain("Mes commandes");
    expect(comptePage).toContain("Mes adresses");
    expect(comptePage).toContain("Ma wishlist");
  });

  it("expose les endpoints commandes et adresses attendus côté backend", () => {
    expect(customerRoutes).toContain('customersRouter.get("/me/orders"');
    expect(customerRoutes).toContain('customersRouter.get("/me/addresses"');
    expect(customerRoutes).toContain('customersRouter.post("/me/addresses"');
    expect(customerRoutes).toContain('customersRouter.delete("/me/addresses/:id"');
  });

  it("met à jour le header avec un lien connexion ou un dropdown client connecté", () => {
    expect(header).toContain("useCustomerAuth");
    expect(header).toContain('href="/connexion"');
    expect(header).toContain('href="/compte?tab=commandes"');
    expect(header).toContain('href="/compte?tab=wishlist"');
    expect(header).toContain("handleCustomerLogout");
    expect(header).toContain("Se déconnecter");
  });
});
