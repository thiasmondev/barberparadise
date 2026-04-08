// ============================================================
// BARBER PARADISE — Structure de Menu
// Source: menu_structure.json fourni par le client
// ============================================================

export interface MenuItem {
  label: string;
  slug: string;
  children?: MenuItem[];
}

export const menuStructure: MenuItem[] = [
  {
    label: "Nouveautés",
    slug: "nouveautes",
  },
  {
    label: "Produits",
    slug: "produits",
    children: [
      { label: "Tous les produits", slug: "tous-les-produits" },
      {
        label: "Cheveux",
        slug: "cheveux",
        children: [
          { label: "Cire", slug: "cire" },
          { label: "Coiffant", slug: "coiffant" },
          { label: "Gel", slug: "gel" },
          { label: "Shampooing cheveux", slug: "shampooing-cheveux" },
        ],
      },
      {
        label: "Barbe",
        slug: "barbe",
        children: [
          { label: "Baume à barbe", slug: "baume-a-barbe" },
          { label: "Huile à barbe", slug: "huile-a-barbe" },
          { label: "Kit", slug: "kit" },
          { label: "Entretien barbe", slug: "entretien-barbe" },
          { label: "Shampooing à barbe", slug: "shampooing-a-barbe" },
        ],
      },
      {
        label: "Rasage",
        slug: "rasage",
        children: [
          { label: "Pré-rasage", slug: "pre-rasage" },
          { label: "Rasage", slug: "rasage-produits" },
          { label: "Après rasage", slug: "apres-rasage" },
        ],
      },
      {
        label: "Corps",
        slug: "corps",
        children: [
          { label: "Déodorant", slug: "deodorant" },
          { label: "Savon", slug: "savon" },
        ],
      },
      {
        label: "Hygiène et entretien",
        slug: "hygiene-et-entretien",
        children: [
          { label: "Hygiène", slug: "hygiene" },
          { label: "Entretien matériel", slug: "entretien-materiel" },
        ],
      },
      { label: "Couleur", slug: "couleur" },
    ],
  },
  {
    label: "Matériel",
    slug: "materiel",
    children: [
      { label: "Tout le matériel", slug: "tout-le-materiel" },
      {
        label: "Tondeuse",
        slug: "tondeuse",
        children: [
          { label: "Clipper", slug: "clipper" },
          { label: "Trimmer", slug: "trimmer" },
          { label: "Shaver", slug: "shaver" },
          { label: "Lames et accessoires", slug: "lames-et-accessoires" },
        ],
      },
      {
        label: "Brosse et peigne",
        slug: "brosse-et-peigne",
        children: [
          { label: "Brosse", slug: "brosse" },
          { label: "Peigne", slug: "peigne" },
        ],
      },
      {
        label: "Ciseaux",
        slug: "ciseaux",
        children: [
          { label: "Sculpteur", slug: "sculpteur" },
          { label: "Ciseaux droits", slug: "ciseaux-droits" },
        ],
      },
      { label: "Sèche-cheveux", slug: "seche-cheveux" },
      {
        label: "Rasoir et accessoire de rasage",
        slug: "rasoir-et-accessoire-de-rasage",
        children: [
          { label: "Rasoir", slug: "rasoir" },
          { label: "Lames de rasoir", slug: "lames-de-rasoir" },
          { label: "Accessoires de rasage", slug: "accessoires-de-rasage" },
        ],
      },
      {
        label: "Accessoire",
        slug: "accessoire",
        children: [
          { label: "Souffleur", slug: "souffleur" },
          { label: "Vaporisateur et nébuliseur", slug: "vaporisateur-et-nebuliseur" },
          { label: "Tapis et organisateur", slug: "tapis-et-organisateur" },
          { label: "Capes", slug: "capes" },
          { label: "Balai à cou et brosse", slug: "balai-a-cou-et-brosse" },
          { label: "Sac", slug: "sac" },
          { label: "Miroir à main", slug: "miroir-a-main" },
          { label: "Outils coloration", slug: "outils-coloration" },
          { label: "Accessoires", slug: "accessoires" },
        ],
      },
    ],
  },
  {
    label: "Marques",
    slug: "marques",
    children: [
      { label: "Andis", slug: "andis" },
      { label: "Babyliss Pro", slug: "babyliss-pro" },
      { label: "Barber Paradise", slug: "barber-paradise" },
      { label: "Beubar", slug: "beubar" },
      { label: "Clubman Pinaud", slug: "clubman-pinaud" },
      { label: "DAUNTLESS MODERN GROOMING", slug: "dauntless-modern-grooming" },
      { label: "Denman", slug: "denman" },
      { label: "Derby", slug: "derby" },
      { label: "Disicide", slug: "disicide" },
      { label: "Dr K Soap", slug: "dr-k-soap" },
      { label: "Euromax", slug: "euromax" },
      { label: "Fatip", slug: "fatip" },
      { label: "Gamma+", slug: "gamma-plus" },
      { label: "Haircut", slug: "haircut" },
      { label: "Hercules Sägemann", slug: "hercules-sagemann" },
      { label: "Hey joe !", slug: "hey-joe" },
      { label: "Jacques SEBAN", slug: "jacques-seban" },
      { label: "JRL", slug: "jrl" },
      { label: "King Brown", slug: "king-brown" },
      { label: "L3VEL3", slug: "l3vel3" },
      { label: "Lockhart's", slug: "lockharts" },
      { label: "OMEGA", slug: "omega" },
      { label: "Osaka", slug: "osaka" },
      { label: "Panasonic", slug: "panasonic" },
      { label: "Style Craft", slug: "style-craft" },
      { label: "Trimmercide", slug: "trimmercide" },
      { label: "Vitos", slug: "vitos" },
      { label: "Wahl", slug: "wahl" },
      { label: "Y/S PARK", slug: "ys-park" },
    ],
  },
  {
    label: "PROMO",
    slug: "promo",
  },
  {
    label: "Contact",
    slug: "contact",
  },
];

// Toutes les marques pour le filtre
export const allBrands = menuStructure
  .find((m) => m.slug === "marques")
  ?.children?.map((b) => b.label) ?? [];
