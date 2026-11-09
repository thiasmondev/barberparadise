# Rapport pré-commit — Remises doublées et correction depuis la commande

Date : 9 novembre 2026

## Signalement et limites du diagnostic

Une remise appliquée sur un article de BP-2026-91002 apparaît doublée et l’administrateur ne parvient pas à la corriger.

L’utilisateur a confirmé une remise de **20 % sur le YLS Osaka**. Le prix enregistré et la quantité de cette ligne ne sont pas connus dans la session. La session ne dispose pas d’un accès authentifié aux données de cette commande réelle ; aucun montant en euros de réparation n’est deviné. Le défaut de calcul décrit ici a été identifié dans le code et reproduit avec des données de test. Il n’est pas présenté comme une lecture ou une réparation déjà effectuée sur BP-2026-91002.

## Défaut identifié

Lors de la réouverture d’un brouillon, le formulaire utilisait `orderDiscountValue ?? discountAmount` pour initialiser la remise globale. Or `discountAmount` est, dans les brouillons et les ventes POS catalogue, le total des remises de lignes et de la remise globale.

Exemple synthétique : une ligne possède 10 € de remise, aucune remise globale, et le total des remises vaut 10 €. L’ancien formulaire réintroduisait les mêmes 10 € dans le champ de remise globale, tout en conservant les 10 € sur la ligne. Une sauvegarde appliquait donc les deux.

Le formulaire doit utiliser la remise globale explicite lorsqu’elle existe. Pour un enregistrement historique sans définition globale explicite, seul le résidu du total des remises après soustraction des remises de lignes est une remise globale. Une remise de ligne n’est jamais recopiée intégralement à ce second niveau.

Les anciennes ventes rapides POS peuvent contenir la même remise conceptuelle dans les champs de ligne et de commande. Le chargement dédié de correction évite de l’appliquer deux fois quand l’agrégat atteste une seule remise sur cette ligne personnalisée.

## Possibilité de correction

Le panneau classique de modification d’articles ne propose pas la remise globale et est masqué pour les commandes POS. De plus, il recalcule les prix depuis le catalogue actuel : ce n’est pas un outil adapté à une simple correction de remise sur les prix historiques.

Un parcours distinct « Corriger les remises » est ajouté depuis le récapitulatif financier, avec :

1. Chargement des remises enregistrées et de leur base HT/TTC.
2. Édition des remises de chaque ligne et de la remise globale ; une valeur nulle ou zéro permet de retirer une remise.
3. Prévisualisation serveur de l’ancien total, du nouveau total et de la différence.
4. Confirmation explicite avant enregistrement.

La route de correction travaille sur les prix et quantités enregistrés. Elle ne relit pas le catalogue pour changer un tarif, ne remplace pas les lignes et n’ajuste pas le stock. Les identifiants des articles restent inchangés.

Une remise fixe en euros s’applique une fois à la ligne entière. Un pourcentage s’applique au prix de cette ligne multiplié par sa quantité. Ces deux conventions sont distinctes et testées.

## Garanties financières

- `paidAmount`, `refundedAmount`, le statut du paiement et les références de paiement ne sont pas modifiés par la correction des remises.
- Aucun lien de paiement, remboursement ou e-mail n’est déclenché par ces routes.
- Les frais de paiement B2B déjà enregistrés sont conservés exactement, sans recalcul du pourcentage.
- Les prix POS restent TTC, même pour un client professionnel ; les lignes B2B catalogue hors POS restent sur leur base HT enregistrée.
- Les montants restant dus ou potentiellement trop perçus sont affichés comme des soldes à gérer séparément, pas comme des encaissements ou remboursements déjà réalisés.
- Une facture existante n’est pas écrasée automatiquement. `itemsLastModifiedAt` signale sa régénération nécessaire après correction.
- Un verrou sur `updatedAt` empêche d’enregistrer un aperçu périmé après un webhook ou une intervention concurrente.
- Une transaction garantit le rollback des totaux si la modification d’une ligne échoue.
- Les commandes annulées/remboursées, les commandes avec lien de paiement actif et celles associées à un échange non annulé sont verrouillées pour éviter de désynchroniser leurs montants.

## Tests

Les tests serveur ont été exécutés avec une base Prisma simulée et un serveur HTTP local, sans données clients réelles :

- Remise fixe de 10 € sur une ligne de 100 € × 2 : total 190 €, pas 180 €.
- Remise de 10 % sur la même ligne : total 180 €.
- Remise de 20 % sur une ligne synthétique de 100 € × 2 : total 160 €, remise de 40 € une seule fois. Ces prix ne sont pas ceux présumés du YLS Osaka réel.
- Retrait d’une remise et conservation d’une véritable remise globale résiduelle.
- Distinction TTC POS / HT B2B et conservation des frais historiques.
- Rejet des lignes inconnues, des omissions, des valeurs négatives et des pourcentages supérieurs à 100.
- Aperçu sans écriture, droits administrateur, version périmée, sauvegarde atomique et rollback.
- Identifiants, prix, quantités, paiements et référence de facture conservés.

Les tests existants de tarifs professionnels, d’échanges, de paiements différés, de paniers clients et de ventilation POS passent. TypeScript backend : succès.

Les deux bancs de tests frontend réussissent : helpers et round-trip du vrai formulaire brouillon ; composant React avec chargement canonique, aperçu sans écriture, confirmation explicite, valeur zéro, conflit de version, lien actif et solde inconnu. Les cas de 20 % sur une ligne et de conservation des remises pendant l’édition d’adresse/notes sont couverts avec des données synthétiques.

TypeScript frontend : succès. ESLint des fichiers modifiés : aucune erreur, 19 avertissements préexistants des grandes pages (hooks et balises image). Le nouveau composant et les helpers ne produisent pas d’avertissement. Build frontend final de production : succès.

Commandes : `npm run test:order-discounts` côté backend ; `node src/lib/order-discounts.test.cjs` et `REACT_TEST_NODE_MODULES=/tmp/customer-carts-tests/node_modules node src/components/admin/OrderDiscountEditor.test.cjs` côté frontend. Le renderer React de test est installé hors des dépendances de production.

## Déploiement et action restant nécessaire

Aucune migration, variable d’environnement ou modification Render n’est prévue. Le rapport est rédigé avant le commit.

Le correctif logiciel ne répare pas automatiquement les montants d’une commande historique. Après déploiement, Mathias pourra retirer la remise globale accidentelle ou corriger la remise de la ligne dans le nouveau panneau, contrôler le total exact dans l’aperçu puis confirmer. La réparation spécifique de BP-2026-91002 dépend de la vérification de sa remise réellement souhaitée.
