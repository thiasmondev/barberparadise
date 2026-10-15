# Rapport pré-commit — correction du parcours d’échange BP-2026-34586

**Date :** 15 octobre 2026
**Périmètre :** fiche détail d’une commande dans l’administration, workflow d’échange et règlement de la différence.

## Incident traité

Sur la commande **BP-2026-34586**, le scénario rapporté consiste à reprendre une tondeuse XCEED et à la remplacer par une **StyleCraft Saber II**, plus chère.

Deux défaillances du parcours ont été identifiées :

1. La sélection d’un produit de remplacement et la création de l’échange pouvaient ne pas rester visibles si une réponse réseau plus ancienne arrivait après la création ; l’affichage dépendait trop d’un rechargement asynchrone secondaire.
2. Le formulaire ne présentait aucun calcul avant création : ni valeur de reprise, ni prix du remplacement, ni différence à encaisser ou à rembourser. Le bouton de l’étape suivante restait aussi trop générique pour indiquer l’envoi du lien de règlement.

L’API d’administration exige une authentification ; aucune donnée de la commande, aucun stock et aucun règlement réel n’ont été modifiés pendant le diagnostic.

## Changements apportés

### Interface d’échange

- Le remplacement choisi est clairement maintenu à l’écran : son nom est recopié dans le champ de recherche, une carte « Article de remplacement sélectionné » est affichée et l’action **Changer** permet de reprendre la recherche.
- Seuls les produits catalogue actifs sont proposés.
- Les variantes sont obligatoires lorsqu’un produit en possède, et seules celles ayant assez de stock pour la quantité demandée sont proposées.
- La création d’échange est bloquée tant que l’article retourné, le produit/variante de remplacement, la quantité et le stock ne sont pas valides.
- Un aperçu financier apparaît avant la création :
  - valeur historique de l’article repris, remise de ligne incluse ;
  - valeur du produit de remplacement ;
  - montant exact **à encaisser** si positif, **à rembourser** si négatif, ou absence de règlement si nul ;
  - montants TTC pour B2C et HT pour B2B, y compris un éventuel taux historique de TVA à 0 %.
- Après réponse positive du backend, l’échange est injecté immédiatement dans la liste et un message de confirmation est affiché. Une réponse plus ancienne ne peut plus effacer cet affichage.

### Règlement et envoi au client

- Après réception et inspection du retour, le bouton de complément indique directement le montant et l’action : **Envoyer le lien de règlement (montant)**.
- Après l’envoi, l’interface indique que le lien est envoyé et attend la confirmation du paiement avant le renvoi.
- Côté backend, un lien de règlement actif est réutilisé si l’action est répétée : aucun deuxième encaissement ni second email ne peut être créé par double clic ou requête répétée.
- Le comportement de sécurité existant est conservé : le complément ne passe pas la commande à un état réglé de façon optimiste ; la confirmation dépend toujours du webhook de paiement.

## Règle de calcul vérifiée

La différence utilisée par l’aperçu est alignée sur le service backend `calculateOrderExchangeFinancials` :

```text
valeur retour = prix unitaire enregistré × quantité - part de remise de ligne
valeur remplacement = prix de remplacement applicable × quantité
différence = valeur remplacement - valeur retour
```

Le prix de reprise est donc le prix réellement facturé lors de la vente, et non le prix catalogue actuel. Le catalogue public confirme que la Saber II noire est active et disponible au prix public de 299 €, mais le montant final de BP-2026-34586 est volontairement calculé depuis son prix historique et ses éventuelles remises.

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `frontend/src/app/admin/commandes/[id]/page.tsx` | Sélection persistante, garde de réponses périmées, aperçu financier, validation de stock/variante, retours d’état et libellés de règlement explicites. |
| `frontend/src/lib/admin-api.ts` | Typage du retour indiquant qu’un lien de règlement existant a été réutilisé. |
| `backend/src/routes/order-exchanges.ts` | Idempotence de l’envoi d’un lien de règlement actif. |
| `backend/src/services/orderExchangeService.test.ts` | Test B2C de non-régression : article repris à 259 € remplacé par un article à 299 € → complément de 40 €. |

Aucune migration Prisma et aucune variable d’environnement n’ont été ajoutées ou modifiées.

## Validations exécutées

| Contrôle | Résultat |
|---|---|
| Catalogue public : recherche XCEED et Saber II | OK — Saber II noire active, stock disponible lors du contrôle. |
| `npm run test:exchanges` (backend) | OK — calculs B2C, B2B, remises et cas remplacement plus cher. |
| `npx tsc --noEmit` (backend) | OK. |
| `DATABASE_URL=postgresql://validation:validation@127.0.0.1:5432/validation?schema=public npx prisma validate` | OK — validation sans connexion ni secret de production. |
| `npx tsc --noEmit` (frontend) | OK. |
| `pnpm build` (frontend) | OK — compilation, vérification TypeScript et génération des pages réussies. |
| `pnpm lint` (frontend) | OK avec avertissements préexistants de dépendances de hooks et d’optimisation d’images, sans erreur bloquante. |
| `git diff --check` | OK — aucun problème d’espaces ou de patch. |
| Scan des lignes ajoutées pour secrets/identifiants | OK — aucune donnée sensible ajoutée. |

## Vérification fonctionnelle recommandée après déploiement

1. Ouvrir **BP-2026-34586** dans l’administration.
2. Choisir l’article XCEED retourné, quantité 1, puis rechercher et sélectionner **StyleCraft Saber II**.
3. Sélectionner la variante noire : elle doit rester clairement visible.
4. Contrôler l’aperçu « Différence d’échange » : il doit afficher les valeurs historiques de cette commande et le montant exact à encaisser.
5. Créer l’échange : la carte d’échange doit apparaître immédiatement et confirmer la réservation de la Saber II.
6. Après retour reçu et inspecté, utiliser le bouton libellé avec le montant afin d’envoyer le lien de règlement. Le statut doit ensuite indiquer que le lien est envoyé et attendre la confirmation avant le renvoi.
