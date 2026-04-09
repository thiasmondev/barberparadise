// ============================================================
// BARBER PARADISE — Script de seed pour PostgreSQL (production)
// ============================================================
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'barberparadise_salt').digest('hex');
}

async function main() {
  console.log('🌱 Démarrage du seed...');

  // Créer l'admin par défaut
  const adminExists = await prisma.admin.findUnique({
    where: { email: 'admin@barberparadise.fr' }
  });

  if (!adminExists) {
    await prisma.admin.create({
      data: {
        email: 'admin@barberparadise.fr',
        password: hashPassword('admin123'),
        name: 'Mathias',
        role: 'superadmin'
      }
    });
    console.log('✅ Admin créé: admin@barberparadise.fr / admin123');
  } else {
    console.log('ℹ️  Admin déjà existant');
  }

  // Créer les catégories
  const categories = [
    { name: "Matériel", slug: "materiel", parentSlug: "", order: 1 },
    { name: "Tondeuse", slug: "tondeuse", parentSlug: "materiel", order: 1 },
    { name: "Clipper", slug: "clipper", parentSlug: "tondeuse", order: 1 },
    { name: "Trimmer", slug: "trimmer", parentSlug: "tondeuse", order: 2 },
    { name: "Shaver", slug: "shaver", parentSlug: "tondeuse", order: 3 },
    { name: "Lames et accessoires", slug: "lames-accessoires", parentSlug: "tondeuse", order: 4 },
    { name: "Brosse et peigne", slug: "brosse-peigne", parentSlug: "materiel", order: 2 },
    { name: "Brosse", slug: "brosse", parentSlug: "brosse-peigne", order: 1 },
    { name: "Peigne", slug: "peigne", parentSlug: "brosse-peigne", order: 2 },
    { name: "Ciseaux", slug: "ciseaux", parentSlug: "materiel", order: 3 },
    { name: "Sculpteur", slug: "sculpteur", parentSlug: "ciseaux", order: 1 },
    { name: "Ciseaux droits", slug: "ciseaux-droits", parentSlug: "ciseaux", order: 2 },
    { name: "Sèche-cheveux", slug: "seche-cheveux", parentSlug: "materiel", order: 4 },
    { name: "Rasoir et accessoire de rasage", slug: "rasoir-accessoire", parentSlug: "materiel", order: 5 },
    { name: "Rasoir", slug: "rasoir", parentSlug: "rasoir-accessoire", order: 1 },
    { name: "Lames de rasoir", slug: "lames-rasoir", parentSlug: "rasoir-accessoire", order: 2 },
    { name: "Accessoires de rasage", slug: "accessoires-rasage", parentSlug: "rasoir-accessoire", order: 3 },
    { name: "Accessoire", slug: "accessoire", parentSlug: "materiel", order: 6 },
    { name: "Souffleur", slug: "souffleur", parentSlug: "accessoire", order: 1 },
    { name: "Vaporisateur et nébuliseur", slug: "vaporisateur", parentSlug: "accessoire", order: 2 },
    { name: "Tapis et organisateur", slug: "tapis-organisateur", parentSlug: "accessoire", order: 3 },
    { name: "Capes", slug: "capes", parentSlug: "accessoire", order: 4 },
    { name: "Balai à cou et brosse", slug: "balai-cou", parentSlug: "accessoire", order: 5 },
    { name: "Sac", slug: "sac", parentSlug: "accessoire", order: 6 },
    { name: "Miroir à main", slug: "miroir", parentSlug: "accessoire", order: 7 },
    { name: "Outils coloration", slug: "outils-coloration", parentSlug: "accessoire", order: 8 },
    { name: "Accessoires", slug: "accessoires-divers", parentSlug: "accessoire", order: 9 },
    { name: "Produits", slug: "produits", parentSlug: "", order: 2 },
    { name: "Cheveux", slug: "cheveux", parentSlug: "produits", order: 1 },
    { name: "Cire", slug: "cire", parentSlug: "cheveux", order: 1 },
    { name: "Coiffant", slug: "coiffant", parentSlug: "cheveux", order: 2 },
    { name: "Gel", slug: "gel", parentSlug: "cheveux", order: 3 },
    { name: "Shampooing cheveux", slug: "shampooing-cheveux", parentSlug: "cheveux", order: 4 },
    { name: "Barbe", slug: "barbe", parentSlug: "produits", order: 2 },
    { name: "Baume à barbe", slug: "baume-barbe", parentSlug: "barbe", order: 1 },
    { name: "Huile à barbe", slug: "huile-barbe", parentSlug: "barbe", order: 2 },
    { name: "Kit", slug: "kit-barbe", parentSlug: "barbe", order: 3 },
    { name: "Entretien barbe", slug: "entretien-barbe", parentSlug: "barbe", order: 4 },
    { name: "Shampooing à barbe", slug: "shampooing-barbe", parentSlug: "barbe", order: 5 },
    { name: "Rasage", slug: "rasage", parentSlug: "produits", order: 3 },
    { name: "Pré-rasage", slug: "pre-rasage", parentSlug: "rasage", order: 1 },
    { name: "Produit de rasage", slug: "produit-rasage", parentSlug: "rasage", order: 2 },
    { name: "Après rasage", slug: "apres-rasage", parentSlug: "rasage", order: 3 },
    { name: "Corps", slug: "corps", parentSlug: "produits", order: 4 },
    { name: "Déodorant", slug: "deodorant", parentSlug: "corps", order: 1 },
    { name: "Savon", slug: "savon", parentSlug: "corps", order: 2 },
    { name: "Hygiène et entretien", slug: "hygiene-entretien", parentSlug: "produits", order: 5 },
    { name: "Hygiène", slug: "hygiene", parentSlug: "hygiene-entretien", order: 1 },
    { name: "Entretien matériel", slug: "entretien-materiel", parentSlug: "hygiene-entretien", order: 2 },
    { name: "Couleur", slug: "couleur", parentSlug: "produits", order: 6 },
  ];

  let catCreated = 0;
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, description: "", image: "" }
    });
    catCreated++;
  }
  console.log(`✅ ${catCreated} catégories créées/vérifiées`);

  console.log('🎉 Seed de base terminé!');
  console.log('📦 Les 405 produits seront importés via le script Python seed_products.py');
  console.log('   Commande: DATABASE_URL=<url> python3 seed_products.py');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
