# Rapport pré-commit — correction prix TTC des échanges caisse

**Date :** 15 octobre 2026
**Commande de référence :** BP-2026-34586
**Périmètre :** calcul et affichage du prix dans un échange de vente caisse.

## Incident confirmé

La capture de l’administration montre une vente caisse pour laquelle :

- la tondeuse XCEED retournée est enregistrée à **259,00 € TTC** ;
- la StyleCraft Saber II de remplacement a un prix public de **299,00 € TTC** ;
- l’aperçu convertissait néanmoins la Saber II à **249,17 € HT** et affichait donc à tort un remboursement de **9,83 €**.

La cause est confirmée dans le flux POS : une vente caisse peut être associée à un client qui possède un compte professionnel (`isB2B = true`), mais la caisse enregistre les lignes au prix public TTC. Le service d’échange se fondait uniquement sur `isB2B`, sans exclure le canal `pos`.

## Correction

- Une nouvelle règle partagée `usesProfessionalExchangePricing` détermine si un échange doit employer les prix professionnels HT.
- Elle retourne `false` pour toute vente de caisse (`channel = pos`), même lorsqu’un compte professionnel est associé au client.
- Le backend crée désormais les échanges POS avec les prix publics TTC et le libellé fiscal `TTC`.
- L’aperçu frontend, les prix de résultats de recherche, les variantes et le badge d’échange utilisent la même règle : une vente POS affiche des montants TTC.
- Les échanges web B2B conservent leur fonctionnement HT inchangé.

## Résultat attendu pour BP-2026-34586

Après déploiement, pour un nouvel échange XCEED vers Saber II :

| Ligne | Montant attendu |
|---|---:|
| Retour tondeuse XCEED | -259,00 € TTC |
| Remplacement Saber II | +299,00 € TTC |
| Différence | **+40,00 € TTC à encaisser** |

Le montant effectif continue à utiliser le prix historique et les remises de la ligne retournée ; le tableau ci-dessus correspond au cas capturé sans remise de ligne.

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `backend/src/services/orderExchangeService.ts` | Choix des prix HT uniquement pour les commandes web B2B, jamais pour le canal caisse. |
| `frontend/src/app/admin/commandes/[id]/page.tsx` | Aperçu, recherche, variantes et badge d’échange alignés sur les prix TTC d’une vente POS. |
| `backend/src/services/orderExchangeService.test.ts` | Test de non-régression d’un client professionnel sur vente caisse : 259 € TTC → 299 € TTC = 40 € TTC à encaisser. |

## Validations exécutées

| Contrôle | Résultat |
|---|---|
| `npm run test:exchanges` | OK — inclut le scénario POS associé à un client professionnel. |
| `npx tsc --noEmit` backend | OK. |
| Validation Prisma avec URL locale factice non connectée | OK. |
| `npx tsc --noEmit` frontend | OK. |
| `pnpm lint` frontend | OK avec avertissements préexistants, sans erreur. |
| `pnpm build` frontend | OK — build Next.js production terminé. |
| `git diff --check` | OK. |
| Scan des lignes ajoutées pour identifiants/secret | OK — aucune donnée sensible ajoutée. |

## Limite et vérification après déploiement

Les anciens échanges déjà créés conservent leurs montants historiques, notamment l’échange erroné déjà annulé visible dans la capture. La correction s’applique à la création d’un nouvel échange.

Après la fin du déploiement, rouvrir BP-2026-34586, choisir XCEED puis la Saber II : le badge doit indiquer **Montants TTC** et la différence doit être **+40,00 € à encaisser** si la ligne XCEED n’a aucune remise enregistrée.
