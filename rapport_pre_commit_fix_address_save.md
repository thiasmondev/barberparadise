# Rapport Pré-commit : Correction sauvegarde adresse fiche commande

## Description du problème
Sur la page d'administration d'une commande (`/admin/commandes/[id]`), la modification et l'enregistrement de l'adresse de livraison ou de facturation échouaient avec l'erreur "Sélectionnez une variante disponible pour [produit]". 
Ce blocage se produisait car la validation du backend était trop stricte lors de la mise à jour d'une commande existante, et le frontend omettait le `variantId` dans le payload envoyé.

## Causes identifiées
1. **Frontend** : La fonction `handleSaveOrder` omettait d'inclure le `variantId` lors de la construction du payload `items` envoyé à l'API.
2. **Backend** : La fonction `calculateAdminDraftTotals` dans `admin.ts` exigeait une variante valide et en stock pour chaque produit avec variantes, même lorsque `allowInactiveProducts` était `true` (ce qui est le cas lors de la modification d'une commande existante). Cela posait problème pour les commandes contenant des variantes historiques supprimées ou en rupture de stock.

## Corrections apportées

### 1. Frontend (`frontend/src/app/admin/commandes/[id]/page.tsx`)
- Ajout de `variantId: item.variantId ?? null` dans le `map` des `items` au sein de `handleSaveOrder`.
- Cela garantit que l'information sur la variante est correctement transmise au backend lors de l'enregistrement.

### 2. Backend (`backend/src/routes/admin.ts`)
- Assouplissement de la validation dans `calculateAdminDraftTotals`.
- La vérification stricte de l'existence de la variante et de son stock n'est désormais effectuée que si `!params.allowInactiveProducts`.
- En mode modification de commande existante (`allowInactiveProducts: true`), on tolère les variantes historiques supprimées ou inactives, ce qui permet de sauvegarder l'adresse sans erreur.

## Validation
- [x] Compilation TypeScript backend réussie (`npx tsc --noEmit`)
- [x] Compilation TypeScript frontend réussie (`npx tsc --noEmit`)
- [x] Logique métier préservée (la validation stricte reste active pour les nouveaux brouillons)
