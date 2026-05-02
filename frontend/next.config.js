/** @type {import('next').NextConfig} */
const productRedirects = require("./src/redirects/products.json");

const nextConfig = {
  reactStrictMode: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "barberparadise-backend.onrender.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      ...productRedirects,
      // Pages produits Shopify → nouveau site
      {
        source: "/products/:slug",
        destination: "/produit/:slug",
        permanent: true,
      },
      // Collections Shopify → catalogue filtré
      {
        source: "/collections/all",
        destination: "/catalogue",
        permanent: true,
      },
      {
        source: "/collections/:slug",
        destination: "/catalogue?category=:slug",
        permanent: true,
      },
      // Pages Shopify → nouvelles pages
      {
        source: "/pages/a-propos",
        destination: "/contact",
        permanent: true,
      },
      // Politiques Shopify → pages légales
      {
        source: "/policies/terms-of-service",
        destination: "/cgv",
        permanent: true,
      },
      {
        source: "/policies/refund-policy",
        destination: "/cgv",
        permanent: true,
      },
      {
        source: "/policies/privacy-policy",
        destination: "/politique-de-confidentialite",
        permanent: true,
      },
      {
        source: "/policies/legal-notice",
        destination: "/mentions-legales",
        permanent: true,
      },
      {
        source: "/policies/cookies",
        destination: "/cookies",
        permanent: true,
      },
      // Compte client Shopify → nouveau compte
      {
        source: "/account",
        destination: "/compte",
        permanent: true,
      },
      {
        source: "/account/login",
        destination: "/connexion",
        permanent: true,
      },
      {
        source: "/account/register",
        destination: "/inscription",
        permanent: true,
      },
      // Panier Shopify → nouveau panier
      {
        source: "/cart",
        destination: "/panier",
        permanent: true,
      },
      // Blog Shopify → blog nouveau site
      {
        source: "/blogs/:blog/:slug",
        destination: "/blog/:slug",
        permanent: true,
      },
      {
        source: "/blogs/:slug",
        destination: "/blog",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
