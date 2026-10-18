# Rapport pré-commit — Parcours d’échange POS expédié

**Date :** 18 octobre 2026
**Périmètre :** correction et extension du parcours d’échange, notamment pour la commande `BP-2026-34586`.

## Besoin couvert

Une vente passée en caisse peut désormais donner lieu à un échange dont le remplacement est :

- remis en boutique ; ou
- expédié au client, à domicile ou vers un point relais sélectionné.

Le parcours traite aussi le complément réellement dû, par exemple **40,00 € TTC** lorsqu’un article vendu 259,00 € TTC est échangé contre un article à 299,00 € TTC.

## Changements apportés

### Parcours et interface d’administration

- Ajout d’un choix obligatoire de remise du remplacement : boutique ou expédition.
- Pour une expédition, saisie/choix de l’adresse, choix domicile ou point relais, recherche et sélection du point relais.
- Affichage immédiat de l’article de remplacement dans la fiche de commande après règlement financier validé, sans effacer les lignes d’origine.
- Ajout d’un formulaire de confirmation d’encaissement manuel du complément : moyen, date, référence et note facultatives, avec case de confirmation explicite.
- Pour une vente POS dont le remplacement est expédié, ajout de l’action « Confirmer retour reçu et inspecté en boutique », sans imposer inutilement une étiquette de retour.
- Création d’étiquette de remplacement proposée une fois le retour contrôlé et le règlement finalisé ; confirmation d’expédition disponible après création de l’étiquette.
- Drawer d’étiquette responsive mobile/tablette.

### Garanties serveur

- L’adresse et le point relais sont figés dans un snapshot lors de la création de l’échange : une modification ultérieure du compte client ne peut pas rediriger le remplacement.
- Les offres d’étiquettes sont filtrées selon la destination choisie (domicile ou relais).
- L’étiquette de remplacement réutilise strictement le point relais enregistré dans l’échange ; un identifiant envoyé ultérieurement ne peut pas le remplacer.
- Le règlement manuel est traité par une route dédiée à l’échange, séparée de la commande source. **`Order.paidAmount` n’est jamais modifié** par cette action.
- Le montant du complément est dérivé et contrôlé côté serveur depuis le dossier d’échange ; toute valeur fournie différente est refusée.
- Un encaissement manuel est refusé si un lien de règlement est encore actif, afin d’éviter un double encaissement.
- L’API renvoie désormais le contrat complet de l’échange (destination, relais, informations de règlement) sur les transitions, ce qui évite les écrans incomplets après action.
- Lors de l’expédition du remplacement, la commande source passe à `shipped` et `noShipping` est désactivé pour refléter l’envoi réel, y compris pour une vente POS.

### Factures

- Une facture régénérée après un échange financier final affiche la tondeuse de remplacement et les montants cohérents.
- Les lignes de commande initiales ne sont pas supprimées : une projection de facture remplace uniquement les quantités échangées, ce qui préserve l’historique et les références du dossier d’échange.
- Une régénération forcée ne vide plus les références de facture avant que le nouveau PDF soit créé et envoyé au stockage avec succès.
- Le calcul conserve le TTC pour les échanges issus de caisse et le HT pour les commandes B2B web.

### Base de données

Migration ajoutée :
`backend/prisma/migrations/20261018190000_add_pos_exchange_shipment_and_manual_settlement/migration.sql`

Elle introduit les snapshots de destination, le mode de remise, l’enregistrement d’un règlement manuel et le snapshot de relais sur l’étiquette. Les échanges POS historiques restent considérés comme des remises en boutique ; un nouvel échange expédié doit être créé pour bénéficier du nouveau choix de destination.

## Fichiers modifiés

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261018190000_add_pos_exchange_shipment_and_manual_settlement/migration.sql`
- `backend/src/routes/admin.ts`
- `backend/src/routes/order-exchanges.ts`
- `backend/src/services/orderExchangeService.ts`
- `backend/src/services/orderExchangeService.test.ts`
- `backend/src/services/b2cInvoiceService.ts`
- `backend/src/services/proInvoiceService.ts`
- `frontend/src/app/admin/commandes/[id]/page.tsx`
- `frontend/src/lib/admin-api.ts`

## Validation exécutée

| Contrôle | Résultat |
|---|---|
| `npm run test:exchanges` | Réussi |
| `npm run test:manual-payment-breakdowns` | Réussi |
| `npm run test:pos-payments` | Réussi |
| `npm run test:sales-dashboard` | Réussi |
| `npm run test:finance-overview` | Réussi |
| `npm run test:shipping-addresses` | Réussi |
| `npx tsc --noEmit` backend | Réussi |
| `npx prisma validate` backend avec URL de validation locale | Réussi |
| `npx tsc --noEmit` frontend | Réussi |
| `pnpm lint` frontend | Réussi, avertissements préexistants non bloquants |
| `pnpm build` frontend | Réussi ; deux échecs réseau de pré-rendu ont été journalisés mais le processus est sorti avec le code 0 |
| `git diff --check` | Réussi |
| Recherche de secrets dans le diff | Aucun secret ou identifiant ajouté |

## Vérifications fonctionnelles à réaliser après déploiement

1. Ouvrir `BP-2026-34586`, créer un **nouvel** échange si le dossier historique est annulé, sélectionner la Saber II et choisir « Expédier le remplacement ».
2. Confirmer le retour reçu, enregistrer les 40,00 € réellement encaissés dans le formulaire manuel, puis vérifier que `paidAmount` de la commande initiale n’a pas changé.
3. Choisir une destination domicile ou relais, créer l’étiquette, puis confirmer l’expédition et vérifier le suivi envoyé au client.
4. Vérifier l’apparition de la Saber II dans le bloc Articles et régénérer la facture ; contrôler la ligne de remplacement et le total final.
