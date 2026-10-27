# Rapport pré-commit — Tarification professionnelle par seuil

**Date :** 27 octobre 2026
**Périmètre :** catalogue, panier, tunnel de commande, brouillons d’administration, échanges, caisse, factures et gestion des prix professionnels.

## Objectif livré

La commande professionnelle n’est plus bloquée sous 200 € HT. Le seuil devient une condition d’activation du tarif professionnel :

- sous le seuil, le panier demeure commandable au tarif public TTC ;
- à partir du seuil, chaque référence disposant de son propre prix professionnel HT passe à ce tarif ;
- une référence sans prix professionnel reste à son prix public TTC, y compris lorsque le reste de la commande bénéficie du tarif professionnel ;
- le seuil est calculé avant remise, frais de livraison et frais de paiement, sur le prix professionnel HT lorsqu’il existe, ou sur le prix public converti en HT sinon.

Le seuil est configurable par la variable Render `PRO_PRICE_THRESHOLD_HT`, avec une valeur de repli de **200 € HT**. Aucun secret ni valeur sensible n’a été ajouté au code.

## Implémentation contrôlée

- Création du service serveur unique `b2bPricingService` afin que le panier, le checkout, les brouillons et les échanges appliquent exactement la même règle.
- Le prix affiché dans le catalogue et les fiches produit reste public TTC. Le vrai prix est calculé depuis les données fraîches du serveur à partir du panier complet.
- Panier et checkout affichent la progression vers le seuil, le montant HT restant, le statut du tarif appliqué et une distinction explicite entre « Prix pro HT » et « Public TTC ».
- La commande reste possible sous le seuil. Les montants ne sont jamais reçus depuis le navigateur : la création de paiement recalcule les articles et les totaux côté serveur.
- Les variantes n’héritent plus du prix professionnel de leur produit parent. Une variante doit posséder son prix pro propre pour être éligible.
- Ajout du champ nullable `Order.pricingTier` (`pro` / `retail`) et d’une migration additive. Les commandes existantes restent intactes avec une valeur `NULL`; les nouvelles commandes mémorisent leur niveau tarifaire afin de préserver la cohérence des factures et échanges futurs.
- Les ventes caisse restent explicitement en tarif public, même lorsqu’un client professionnel est associé.
- Les échanges respectent le niveau tarifaire enregistré sur la commande d’origine et le prix pro propre de la variante choisie.
- Les variantes peuvent désormais recevoir leur prix pro propre dans l’éditeur de variantes.
- Ajout dans **Admin → Prix professionnels** d’un téléchargement CSV « Références sans prix pro ». Il liste en base les produits simples et les variantes qui n’ont pas de prix pro propre, avec identifiant, slug, marque, SKU, statut et prix public TTC. Cela permet de compléter les références manquantes sans exposer les coûts d’achat.
- L’aperçu de tarification professionnel requiert un jeton client valide appartenant à un compte professionnel approuvé.

## Régressions et validations exécutées

### Tests métier

- `npm run test:professional-pricing` : succès.
  - sous le seuil : prix public conservé ;
  - franchissement du seuil avec panier mixte ;
  - article / variante sans prix pro conservant son prix public ;
  - règle stricte : une variante n’hérite jamais du prix pro parent ;
  - panier B2C inchangé.
- `npm run test:exchanges` : succès, dont couverture du niveau tarifaire retail et du prix propre des variantes.
- `npm run test:shipping-addresses` : succès.
- `npm run test:logistics` : succès.
- `npm run test:manual-payment-breakdowns` : succès.
- `npm run test:pos-payments` : succès.
- `npm run test:sales-dashboard` : succès.
- `npm run test:finance-overview` : succès.

### Compilation et schéma

- Backend : `npx tsc --noEmit` : succès.
- Prisma : validation exécutée avec une URL locale de test non sensible : succès.
- Frontend : `npx tsc --noEmit` : succès.
- Frontend : `pnpm build` : succès.
- Lint ciblé des fichiers concernés : aucune erreur. Les seuls avertissements relevés sont préexistants dans `VariantManager` (balises image et dépendance de hook) et ne bloquent pas la compilation ni le build.

### Hygiène et sécurité

- `git diff --check` : succès.
- Analyse du diff : aucune clé, URL de base de données, jeton ou clé privée codés en dur.
- La migration est additive et ne modifie ni ne re-tarife les commandes historiques.
- Aucun `paidAmount` n’est mis à jour côté navigateur ; seuls les flux existants confirmés côté serveur restent autoritaires.

## Vérifications à faire après déploiement

1. Connecté avec un compte pro approuvé, ajouter des références sous 200 € HT : vérifier que le panier est commandable au prix public TTC et affiche la progression.
2. Ajouter suffisamment de références pour atteindre 200 € HT : vérifier que seules les lignes ayant un prix pro propre basculent au prix pro HT.
3. Télécharger le CSV « Références sans prix pro » dans l’administration puis renseigner les tarifs manquants, produit par produit ou variante par variante.
4. Créer une nouvelle commande et vérifier le `pricingTier` enregistré, puis un échange associé afin de confirmer que la même base de prix est conservée.
5. Confirmer que Render a appliqué la migration Prisma avant d’accepter des commandes avec la nouvelle version du backend.
