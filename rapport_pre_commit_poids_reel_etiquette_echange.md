# Rapport pré-commit — Poids réel pour les étiquettes d’échange

**Date :** 19 octobre 2026
**Périmètre :** étiquette de retour ou de renvoi d’un dossier d’échange, notamment l’expédition de remplacement de `BP-2026-34586`.

## Anomalie corrigée

Le drawer d’étiquette d’échange calculait les offres à partir du poids catalogué de l’article, avec une valeur de repli de 100 g. Il affichait donc par exemple le premier palier à 4,99 € alors que le colis préparé pouvait être beaucoup plus lourd. Ce poids par défaut pouvait aussi être utilisé pour créer l’étiquette.

## Correction apportée

### Dans le drawer d’échange

- Le premier écran demande désormais le **poids réel du colis fermé, emballage inclus**.
- Aucun devis n’est chargé tant que ce poids n’est pas renseigné.
- L’utilisateur saisit le poids en kilogrammes, avec prise en charge de la virgule, entre **0,100 kg et 30 kg**.
- Le bouton « Calculer les offres » recalcule le prix pour le poids saisi.
- Toute modification du poids invalide les anciens devis : il faut les recalculer avant de pouvoir créer l’étiquette.
- Le bouton final devient « Créer l’étiquette au poids réel » et reste désactivé tant que le devis ne correspond pas exactement au poids actuel.
- Après création, le poids enregistré est affiché près du suivi dans le dossier d’échange.

### Côté serveur

- Les routes de devis et de création d’étiquette imposent aussi un poids entier valide entre 100 g et 30 000 g.
- Aucun appel direct ne peut désormais retomber sur le poids du catalogue ou sur 100 g.
- Le même poids est utilisé pour :
  1. calculer l’offre ;
  2. calculer le montant facturé ;
  3. créer le document transporteur ;
  4. enregistrer l’expédition d’échange.
- Le devis du remplacement inclut la couverture appliquée lors de l’achat afin que le prix affiché soit le prix réellement utilisé à la création de l’étiquette.

## Exemple de palier vérifié

Avec la grille tarifaire active, sans option additionnelle :

| Poids réel | Palier Colissimo | Montant |
|---|---:|---:|
| 250 g | jusqu’à 250 g | 4,99 € |
| 2 180 g | jusqu’à 5 kg | 14,99 € |

Les prix affichés dans l’administration suivent la grille transporteur configurée et les éventuelles options incluses dans le devis.

## Fichiers modifiés

- `backend/src/routes/order-exchanges.ts`
- `backend/src/services/logisticsCarrierService.test.ts`
- `frontend/src/app/admin/commandes/[id]/page.tsx`
- `frontend/src/lib/admin-api.ts`

## Validations exécutées

| Contrôle | Résultat |
|---|---|
| `npm run test:logistics` | Réussi ; couvre désormais les paliers 250 g et 2,180 kg |
| `npm run test:exchanges` | Réussi |
| `npm run test:manual-payment-breakdowns` | Réussi |
| `npm run test:pos-payments` | Réussi |
| `npm run test:sales-dashboard` | Réussi |
| `npm run test:finance-overview` | Réussi |
| `npx tsc --noEmit` backend | Réussi |
| `npx prisma validate` avec URL locale de validation | Réussi |
| `npx tsc --noEmit` frontend | Réussi |
| `pnpm lint` frontend | Réussi avec avertissements préexistants non bloquants |
| `pnpm build` frontend | Réussi |
| `git diff --check` | Réussi |
| Scan des secrets ajoutés au diff | Aucun secret détecté |

## Vérification après déploiement

1. Ouvrir l’échange de `BP-2026-34586` et sélectionner « Préparer l’expédition du remplacement ».
2. Saisir le poids du colis prêt à partir, par exemple `0,850` ou la valeur mesurée.
3. Cliquer sur « Calculer les offres » et contrôler le prix affiché.
4. Créer l’étiquette puis vérifier que le poids s’affiche avec le suivi dans le dossier d’échange et sur l’étiquette générée.
