// ============================================================
// BARBER PARADISE — Données mockées produits & catégories
// Couleurs: Primary #4EAADB | Secondary #252525 | BG #FFFFFF
// ============================================================

export interface Product {
  id: number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  originalPrice?: number;
  images: string[];
  description: string;
  shortDescription: string;
  features: string[];
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewCount: number;
  isNew?: boolean;
  isPromo?: boolean;
  tags: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  subcategories: { id: string; name: string; slug: string }[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
}

export interface Review {
  id: number;
  productId: number;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  author: string;
  date: string;
  readTime: number;
}

// ─── CATÉGORIES ────────────────────────────────────────────
export const categories: Category[] = [
  {
    id: "materiel",
    name: "Matériel",
    slug: "materiel",
    description: "Tondeuses, ciseaux, rasoirs et tout le matériel professionnel",
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80",
    subcategories: [
      { id: "tondeuse", name: "Tondeuses", slug: "tondeuse" },
      { id: "ciseaux", name: "Ciseaux", slug: "ciseaux" },
      { id: "rasoir", name: "Rasoirs", slug: "rasoir" },
      { id: "brosse-peigne", name: "Brosses & Peignes", slug: "brosse-peigne" },
      { id: "seche-cheveux", name: "Sèche-cheveux", slug: "seche-cheveux" },
      { id: "accessoire", name: "Accessoires", slug: "accessoire" },
    ],
  },
  {
    id: "produits",
    name: "Produits",
    slug: "produits",
    description: "Soins capillaires, produits de barbe, parfums et hygiène",
    image: "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=600&q=80",
    subcategories: [
      { id: "cheveux", name: "Cheveux", slug: "cheveux" },
      { id: "barbe", name: "Barbe", slug: "barbe" },
      { id: "rasage", name: "Rasage", slug: "rasage" },
      { id: "parfums", name: "Parfums", slug: "parfums" },
      { id: "corps", name: "Corps", slug: "corps" },
      { id: "hygiene", name: "Hygiène", slug: "hygiene" },
    ],
  },
];

// ─── MARQUES ───────────────────────────────────────────────
export const brands: Brand[] = [
  { id: "andis", name: "Andis", slug: "andis", logo: "" },
  { id: "babyliss-pro", name: "Babyliss Pro", slug: "babyliss-pro", logo: "" },
  { id: "wahl", name: "Wahl", slug: "wahl", logo: "" },
  { id: "jrl", name: "JRL", slug: "jrl", logo: "" },
  { id: "stylecraft", name: "Style Craft", slug: "stylecraft", logo: "" },
  { id: "gamma-plus", name: "Gamma+", slug: "gamma-plus", logo: "" },
  { id: "osaka", name: "Osaka", slug: "osaka", logo: "" },
  { id: "lockharts", name: "Lockhart's", slug: "lockharts", logo: "" },
  { id: "hey-joe", name: "Hey Joe!", slug: "hey-joe", logo: "" },
  { id: "king-brown", name: "King Brown", slug: "king-brown", logo: "" },
  { id: "dr-k", name: "Dr K Soap", slug: "dr-k", logo: "" },
  { id: "clubman", name: "Clubman Pinaud", slug: "clubman", logo: "" },
];

// ─── PRODUITS ──────────────────────────────────────────────
export const products: Product[] = [
  // TONDEUSES
  {
    id: 1,
    slug: "jrl-fresh-fade-2020c",
    name: "JRL Fresh Fade 2020C",
    brand: "JRL",
    category: "materiel",
    subcategory: "tondeuse",
    price: 189.00,
    images: [
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&q=80",
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80",
    ],
    description: "La JRL Fresh Fade 2020C est la tondeuse de référence pour les barbiers professionnels. Avec son moteur brushless ultra-puissant et sa lame en acier inoxydable, elle offre une précision de coupe inégalée. Idéale pour les dégradés et les finitions parfaites.",
    shortDescription: "Tondeuse professionnelle à moteur brushless, lame en acier inoxydable",
    features: [
      "Moteur brushless haute performance",
      "Lame en acier inoxydable 2000C",
      "Autonomie 2h30 (charge rapide 90 min)",
      "Vitesse de coupe réglable",
      "Léger : 210g",
      "Zéro-gap ajustable",
    ],
    inStock: true,
    stockCount: 12,
    rating: 4.9,
    reviewCount: 87,
    isNew: false,
    isPromo: false,
    tags: ["tondeuse", "professionnel", "dégradé", "jrl"],
  },
  {
    id: 2,
    slug: "stylecraft-saber-ii",
    name: "StyleCraft Saber II",
    brand: "Style Craft",
    category: "materiel",
    subcategory: "tondeuse",
    price: 219.00,
    images: [
      "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=600&q=80",
    ],
    description: "La StyleCraft Saber II représente l'excellence en matière de tondeuse professionnelle. Son lame Echo DLC, son zéro-gap et sa connectivité USB-C en font l'outil de prédilection des barbiers exigeants.",
    shortDescription: "Lame Echo DLC, zéro-gap, USB-C — la référence StyleCraft",
    features: [
      "Lame Echo DLC ultra-résistante",
      "Zéro-gap précis",
      "Charge USB-C rapide",
      "Moteur magnétique haute vitesse",
      "Corps aluminium anodisé",
      "Autonomie 3h",
    ],
    inStock: true,
    stockCount: 8,
    rating: 4.8,
    reviewCount: 54,
    isNew: true,
    isPromo: false,
    tags: ["tondeuse", "professionnel", "stylecraft", "saber"],
  },
  {
    id: 3,
    slug: "wahl-magic-clip-cordless",
    name: "Wahl Magic Clip Cordless",
    brand: "Wahl",
    category: "materiel",
    subcategory: "tondeuse",
    price: 129.00,
    originalPrice: 149.00,
    images: [
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&q=80",
    ],
    description: "La Wahl Magic Clip Cordless est une tondeuse sans fil légendaire, adoptée par des millions de barbiers dans le monde. Sa lame Fade Blade permet des dégradés impeccables.",
    shortDescription: "La tondeuse sans fil légendaire pour dégradés parfaits",
    features: [
      "Lame Fade Blade brevetée",
      "Autonomie 90 minutes",
      "Moteur V5000 haute performance",
      "Inclus : 8 sabots de guidage",
      "Poids : 198g",
    ],
    inStock: true,
    stockCount: 25,
    rating: 4.7,
    reviewCount: 203,
    isNew: false,
    isPromo: true,
    tags: ["tondeuse", "wahl", "dégradé", "sans-fil"],
  },
  {
    id: 4,
    slug: "andis-master-cordless",
    name: "Andis Master Cordless",
    brand: "Andis",
    category: "materiel",
    subcategory: "tondeuse",
    price: 169.00,
    images: [
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80",
    ],
    description: "L'Andis Master Cordless est une icône de la barberie américaine. Sa lame en acier carbone réglable et son moteur magnétique offrent une performance exceptionnelle.",
    shortDescription: "L'icône américaine de la barberie, version sans fil",
    features: [
      "Lame en acier carbone réglable",
      "Moteur magnétique haute vitesse",
      "Autonomie 2h",
      "Charge rapide en 60 min",
      "Corps en aluminium",
    ],
    inStock: true,
    stockCount: 15,
    rating: 4.8,
    reviewCount: 142,
    isNew: false,
    isPromo: false,
    tags: ["tondeuse", "andis", "professionnel"],
  },
  {
    id: 5,
    slug: "babyliss-pro-lo-profx",
    name: "BaByliss Pro Lo-ProFX",
    brand: "Babyliss Pro",
    category: "materiel",
    subcategory: "tondeuse",
    price: 149.00,
    originalPrice: 179.00,
    images: [
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&q=80",
    ],
    description: "La BaByliss Pro Lo-ProFX est une tondeuse à faible bruit et vibrations, idéale pour les clients sensibles. Son profil bas facilite les finitions et les contours.",
    shortDescription: "Tondeuse silencieuse à profil bas pour finitions précises",
    features: [
      "Moteur ultra-silencieux",
      "Profil bas pour finitions",
      "Lame en acier inoxydable",
      "Autonomie 2h15",
      "Charge USB-C",
    ],
    inStock: true,
    stockCount: 18,
    rating: 4.6,
    reviewCount: 89,
    isNew: false,
    isPromo: true,
    tags: ["tondeuse", "babyliss", "silencieux", "finitions"],
  },
  // CISEAUX
  {
    id: 6,
    slug: "osaka-curvy-6-pouces",
    name: "Osaka Curvy Barber Paradise 6\"",
    brand: "Osaka",
    category: "materiel",
    subcategory: "ciseaux",
    price: 312.00,
    images: [
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80",
    ],
    description: "Les ciseaux Osaka Curvy sont une exclusivité Barber Paradise. Fabriqués au Japon en acier VG-10, leur forme incurvée unique permet une coupe précise et confortable. Idéaux pour les barbiers exigeants.",
    shortDescription: "Ciseaux incurvés exclusifs Barber Paradise, acier japonais VG-10",
    features: [
      "Acier japonais VG-10",
      "Lame incurvée exclusive",
      "Longueur 6 pouces",
      "Vis de tension réglable",
      "Anneau ergonomique",
      "Exclusivité Barber Paradise",
    ],
    inStock: true,
    stockCount: 6,
    rating: 5.0,
    reviewCount: 23,
    isNew: false,
    isPromo: false,
    tags: ["ciseaux", "osaka", "japon", "exclusif"],
  },
  {
    id: 7,
    slug: "ys-park-g-series-6-5",
    name: "Y/S Park G-Series 6.5\"",
    brand: "Y/S PARK",
    category: "materiel",
    subcategory: "ciseaux",
    price: 245.00,
    images: [
      "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80",
    ],
    description: "Les ciseaux Y/S Park G-Series sont des outils de précision fabriqués à Seki City, au Japon. Leur acier cobalt offre une durabilité et un tranchant exceptionnels.",
    shortDescription: "Ciseaux professionnels en acier cobalt, fabriqués à Seki City",
    features: [
      "Acier cobalt premium",
      "Fabriqué à Seki City, Japon",
      "Longueur 6.5 pouces",
      "Lame convexe ultra-tranchante",
      "Anneau offset ergonomique",
    ],
    inStock: true,
    stockCount: 9,
    rating: 4.9,
    reviewCount: 31,
    isNew: false,
    isPromo: false,
    tags: ["ciseaux", "ys-park", "japon", "cobalt"],
  },
  // BROSSES & PEIGNES
  {
    id: 8,
    slug: "denman-brosse-degradee",
    name: "Denman Brosse Dégradé D3",
    brand: "Denman",
    category: "materiel",
    subcategory: "brosse-peigne",
    price: 5.00,
    images: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80",
    ],
    description: "La brosse Denman D3 est l'outil indispensable pour réaliser des dégradés parfaits. Ses picots en nylon souple permettent de travailler les transitions avec précision.",
    shortDescription: "La brosse incontournable pour dégradés parfaits",
    features: [
      "7 rangées de picots nylon",
      "Manche ergonomique antidérapant",
      "Convient tous types de cheveux",
      "Lavable",
    ],
    inStock: true,
    stockCount: 50,
    rating: 4.6,
    reviewCount: 178,
    isNew: false,
    isPromo: false,
    tags: ["brosse", "dégradé", "denman"],
  },
  {
    id: 9,
    slug: "hercules-sagemann-peigne-carbone",
    name: "Hercules Sägemann Peigne Carbone",
    brand: "Hercules Sägemann",
    category: "materiel",
    subcategory: "brosse-peigne",
    price: 12.00,
    images: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80",
    ],
    description: "Les peignes Hercules Sägemann en carbone sont fabriqués en Allemagne. Antistatiques et résistants à la chaleur, ils sont l'outil de référence des coiffeurs professionnels.",
    shortDescription: "Peigne professionnel en carbone antistatique, made in Germany",
    features: [
      "Carbone antistatique",
      "Résistant à la chaleur jusqu'à 220°C",
      "Fabriqué en Allemagne",
      "Dents larges et fines",
    ],
    inStock: true,
    stockCount: 40,
    rating: 4.8,
    reviewCount: 92,
    isNew: false,
    isPromo: false,
    tags: ["peigne", "carbone", "hercules"],
  },
  // PRODUITS CHEVEUX
  {
    id: 10,
    slug: "lockharts-anti-gravity-matte-paste",
    name: "Lockhart's Anti-Gravity Matte Paste",
    brand: "Lockhart's",
    category: "produits",
    subcategory: "cheveux",
    price: 25.99,
    images: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80",
    ],
    description: "La Lockhart's Anti-Gravity Matte Paste est une pâte coiffante à tenue forte et fini mat. Sa formule à base de cire d'abeille et d'extraits naturels offre une coiffure structurée sans brillance.",
    shortDescription: "Pâte coiffante tenue forte, fini mat, formule naturelle",
    features: [
      "Tenue forte",
      "Fini mat",
      "Cire d'abeille naturelle",
      "Sans silicone",
      "Parfum boisé",
      "113g",
    ],
    inStock: true,
    stockCount: 35,
    rating: 4.7,
    reviewCount: 156,
    isNew: false,
    isPromo: false,
    tags: ["coiffant", "mat", "lockharts", "pâte"],
  },
  {
    id: 11,
    slug: "hey-joe-fiber-paste",
    name: "Hey Joe! Fiber Paste",
    brand: "Hey Joe!",
    category: "produits",
    subcategory: "cheveux",
    price: 18.90,
    images: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80",
    ],
    description: "La Hey Joe! Fiber Paste est une pâte fibreuse à tenue moyenne-forte. Idéale pour les coiffures naturelles et texturées, elle apporte du volume et de la définition sans alourdir.",
    shortDescription: "Pâte fibreuse pour coiffures naturelles et texturées",
    features: [
      "Tenue moyenne-forte",
      "Fini naturel",
      "Fibres de kératine",
      "Remodelable",
      "100ml",
    ],
    inStock: true,
    stockCount: 28,
    rating: 4.5,
    reviewCount: 89,
    isNew: false,
    isPromo: false,
    tags: ["coiffant", "fibre", "hey-joe"],
  },
  {
    id: 12,
    slug: "king-brown-pomade-medium-hold",
    name: "King Brown Medium Hold Pomade",
    brand: "King Brown",
    category: "produits",
    subcategory: "cheveux",
    price: 22.50,
    images: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80",
    ],
    description: "La King Brown Medium Hold Pomade est une pommade australienne à tenue moyenne et fini lustré. Parfaite pour les coiffures classiques et les looks rétro.",
    shortDescription: "Pommade australienne tenue moyenne, fini lustré",
    features: [
      "Tenue moyenne",
      "Fini lustré",
      "Formule à base d'eau",
      "Lavable à l'eau",
      "Parfum agrumes",
      "100g",
    ],
    inStock: true,
    stockCount: 22,
    rating: 4.6,
    reviewCount: 67,
    isNew: false,
    isPromo: false,
    tags: ["pommade", "king-brown", "lustré"],
  },
  // PRODUITS BARBE
  {
    id: 13,
    slug: "dr-k-beard-wash",
    name: "Dr K Soap Beard Wash",
    brand: "Dr K Soap",
    category: "produits",
    subcategory: "barbe",
    price: 16.90,
    images: [
      "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=600&q=80",
    ],
    description: "Le Dr K Beard Wash est un shampooing spécialement formulé pour nettoyer la barbe en profondeur tout en préservant ses huiles naturelles. Sa formule irlandaise à base d'extraits de houblon nourrit et adoucit.",
    shortDescription: "Shampooing barbe irlandais aux extraits de houblon",
    features: [
      "Nettoyage en profondeur",
      "Préserve les huiles naturelles",
      "Extraits de houblon irlandais",
      "Sans sulfates agressifs",
      "100ml",
    ],
    inStock: true,
    stockCount: 30,
    rating: 4.8,
    reviewCount: 112,
    isNew: false,
    isPromo: false,
    tags: ["barbe", "shampooing", "dr-k"],
  },
  {
    id: 14,
    slug: "hey-joe-beard-oil-no4",
    name: "Hey Joe! Beard Oil N°4",
    brand: "Hey Joe!",
    category: "produits",
    subcategory: "barbe",
    price: 19.90,
    images: [
      "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=600&q=80",
    ],
    description: "L'huile à barbe Hey Joe! N°4 est une formule premium aux huiles d'argan, jojoba et macadamia. Elle nourrit, assouplit et parfume la barbe avec une senteur boisée et épicée.",
    shortDescription: "Huile à barbe premium aux huiles d'argan, jojoba et macadamia",
    features: [
      "Huile d'argan bio",
      "Huile de jojoba",
      "Huile de macadamia",
      "Parfum boisé épicé",
      "30ml",
    ],
    inStock: true,
    stockCount: 24,
    rating: 4.7,
    reviewCount: 78,
    isNew: false,
    isPromo: false,
    tags: ["barbe", "huile", "hey-joe"],
  },
  // RASAGE
  {
    id: 15,
    slug: "vitos-creme-rasage-verte",
    name: "Vitos Crème de Rasage Verte",
    brand: "Vitos",
    category: "produits",
    subcategory: "rasage",
    price: 8.50,
    images: [
      "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=600&q=80",
    ],
    description: "La crème de rasage Vitos verte est un classique de la barberie italienne. Sa formule à la menthe offre une mousse dense et crémeuse pour un rasage précis et confortable.",
    shortDescription: "Crème de rasage italienne classique à la menthe",
    features: [
      "Formule italienne classique",
      "Mousse dense et crémeuse",
      "Extrait de menthe",
      "Peau douce après rasage",
      "500ml",
    ],
    inStock: true,
    stockCount: 45,
    rating: 4.6,
    reviewCount: 134,
    isNew: false,
    isPromo: false,
    tags: ["rasage", "crème", "vitos", "menthe"],
  },
  {
    id: 16,
    slug: "clubman-pinaud-aftershave",
    name: "Clubman Pinaud After Shave Lotion",
    brand: "Clubman Pinaud",
    category: "produits",
    subcategory: "rasage",
    price: 14.90,
    images: [
      "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=600&q=80",
    ],
    description: "Le Clubman Pinaud After Shave Lotion est une lotion après-rasage légendaire, utilisée depuis 1810. Son parfum iconique et sa formule apaisante en font un incontournable de la barberie traditionnelle.",
    shortDescription: "La lotion après-rasage légendaire depuis 1810",
    features: [
      "Formule originale depuis 1810",
      "Apaise les irritations",
      "Parfum iconique",
      "Effet antiseptique naturel",
      "177ml",
    ],
    inStock: true,
    stockCount: 38,
    rating: 4.8,
    reviewCount: 201,
    isNew: false,
    isPromo: false,
    tags: ["après-rasage", "clubman", "classique"],
  },
  // SÈCHE-CHEVEUX
  {
    id: 17,
    slug: "gamma-plus-aria-dryer",
    name: "Gamma+ Aria Sèche-cheveux Pro",
    brand: "Gamma+",
    category: "materiel",
    subcategory: "seche-cheveux",
    price: 89.00,
    originalPrice: 109.00,
    images: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80",
    ],
    description: "Le Gamma+ Aria est un sèche-cheveux professionnel à moteur ionique. Sa technologie ionique réduit les frisottis et accélère le séchage pour un résultat lisse et brillant.",
    shortDescription: "Sèche-cheveux professionnel ionique, séchage rapide",
    features: [
      "Moteur ionique 2200W",
      "Technologie anti-frisottis",
      "3 vitesses / 2 températures",
      "Buse concentrateur incluse",
      "Diffuseur inclus",
    ],
    inStock: true,
    stockCount: 14,
    rating: 4.5,
    reviewCount: 56,
    isNew: false,
    isPromo: true,
    tags: ["sèche-cheveux", "gamma", "ionique"],
  },
  // TRIMMER
  {
    id: 18,
    slug: "andis-slimline-pro-li",
    name: "Andis Slimline Pro Li T-Blade",
    brand: "Andis",
    category: "materiel",
    subcategory: "tondeuse",
    price: 79.00,
    images: [
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&q=80",
    ],
    description: "L'Andis Slimline Pro Li est le trimmer de finition par excellence. Sa lame T ultra-précise permet de réaliser des contours nets et des finitions impeccables.",
    shortDescription: "Trimmer de finition lame T ultra-précise",
    features: [
      "Lame T en acier carbone",
      "Moteur linéaire haute vitesse",
      "Autonomie 2h",
      "Corps ergonomique slim",
      "Idéal pour contours et finitions",
    ],
    inStock: true,
    stockCount: 20,
    rating: 4.7,
    reviewCount: 118,
    isNew: false,
    isPromo: false,
    tags: ["trimmer", "andis", "finitions", "contours"],
  },
];

// ─── AVIS ──────────────────────────────────────────────────
export const reviews: Review[] = [
  {
    id: 1,
    productId: 1,
    author: "Karim B.",
    rating: 5,
    date: "2024-03-15",
    comment: "Tondeuse exceptionnelle ! La précision est incroyable, mes clients sont ravis. Le moteur brushless est silencieux et puissant.",
    verified: true,
  },
  {
    id: 2,
    productId: 1,
    author: "Thomas M.",
    rating: 5,
    date: "2024-02-28",
    comment: "Meilleur investissement de ma carrière. La lame 2000C est d'une précision chirurgicale.",
    verified: true,
  },
  {
    id: 3,
    productId: 10,
    author: "Alexandre D.",
    rating: 5,
    date: "2024-03-20",
    comment: "Tenue parfaite toute la journée, fini mat naturel. Je ne change plus !",
    verified: true,
  },
  {
    id: 4,
    productId: 6,
    author: "Mehdi K.",
    rating: 5,
    date: "2024-01-10",
    comment: "Des ciseaux d'une qualité exceptionnelle. La coupe est fluide et précise. Exclusivité Barber Paradise bien méritée.",
    verified: true,
  },
];

// ─── BLOG ──────────────────────────────────────────────────
export const blogPosts: BlogPost[] = [
  {
    id: 1,
    slug: "guide-choisir-tondeuse-professionnelle",
    title: "Comment choisir sa tondeuse professionnelle en 2024",
    excerpt: "Moteur brushless ou magnétique ? Lame en acier ou en carbone ? Notre guide complet pour faire le bon choix.",
    content: "",
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80",
    category: "Guides",
    author: "L'équipe Barber Paradise",
    date: "2024-03-10",
    readTime: 8,
  },
  {
    id: 2,
    slug: "technique-degrade-parfait",
    title: "La technique du dégradé parfait : conseils de pros",
    excerpt: "Maîtrisez les fondamentaux du dégradé avec nos conseils d'experts. De la sélection du matériel à la technique de coupe.",
    content: "",
    image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80",
    category: "Techniques",
    author: "L'équipe Barber Paradise",
    date: "2024-02-22",
    readTime: 12,
  },
  {
    id: 3,
    slug: "entretien-barbe-routine-quotidienne",
    title: "Routine d'entretien de la barbe : les étapes essentielles",
    excerpt: "Shampooing, huile, baume, cire... Découvrez la routine complète pour une barbe parfaitement entretenue au quotidien.",
    content: "",
    image: "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=800&q=80",
    category: "Soins",
    author: "L'équipe Barber Paradise",
    date: "2024-01-15",
    readTime: 6,
  },
];

// ─── COMMANDES MOCKÉES ─────────────────────────────────────
export interface Order {
  id: string;
  date: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  items: { productId: number; name: string; quantity: number; price: number }[];
  total: number;
  shippingAddress: string;
}

export const mockOrders: Order[] = [
  {
    id: "BP-2024-001",
    date: "2024-03-15",
    status: "delivered",
    items: [
      { productId: 1, name: "JRL Fresh Fade 2020C", quantity: 1, price: 189.00 },
      { productId: 10, name: "Lockhart's Anti-Gravity Matte Paste", quantity: 2, price: 25.99 },
    ],
    total: 240.98,
    shippingAddress: "12 Rue de la Paix, 75001 Paris",
  },
  {
    id: "BP-2024-002",
    date: "2024-02-08",
    status: "delivered",
    items: [
      { productId: 6, name: "Osaka Curvy Barber Paradise 6\"", quantity: 1, price: 312.00 },
    ],
    total: 312.00,
    shippingAddress: "12 Rue de la Paix, 75001 Paris",
  },
];

// ─── HELPERS ───────────────────────────────────────────────
export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((p) => p.category === category);
}

export function getProductsBySubcategory(subcategory: string): Product[] {
  return products.filter((p) => p.subcategory === subcategory);
}

export function getProductsByBrand(brand: string): Product[] {
  return products.filter((p) => p.brand.toLowerCase() === brand.toLowerCase());
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.rating >= 4.7).slice(0, 8);
}

export function getNewProducts(): Product[] {
  return products.filter((p) => p.isNew);
}

export function getPromoProducts(): Product[] {
  return products.filter((p) => p.isPromo);
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q))
  );
}

export const STATUS_LABELS: Record<Order["status"], string> = {
  pending: "En attente",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export const STATUS_COLORS: Record<Order["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};
