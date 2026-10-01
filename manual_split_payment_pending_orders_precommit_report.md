# Rapport pré-commit — Paiement divisé sur une commande en attente

**Date :** 1 octobre 2026
**Périmètre :** fiche admin `/admin/commandes/[id]` et confirmation manuelle d’un règlement réellement encaissé hors site.

## Objectif

Permettre de choisir **« Paiement divisé »** depuis le bloc **« Confirmer un paiement hors site »** d’une commande en attente, puis de répartir le solde à confirmer sur plusieurs moyens et montants, comme sur l’écran de caisse.

## Changements livrés

| Zone | Modification |
|---|---|
| Interface fiche commande | Ajout de l’option **Paiement divisé** dans la liste des moyens de règlement. |
| Interface fiche commande | Ajout de deux lignes de ventilation par défaut, ajout/suppression de lignes, bouton **Compléter** et indicateur *Reste / Dépassement / Équilibré*. |
| Interface fiche commande | Le bouton de confirmation reste désactivé tant que les lignes ne totalisent pas exactement le solde. La fenêtre de confirmation affiche la répartition exacte. |
| API admin | `POST /api/admin/orders/:id/mark-paid-manual` accepte `paymentMethod: "split"` et `splitLines` en plus des paiements manuels unitaires. |
| Validation serveur | Chaque ligne doit employer un moyen autorisé, être strictement positive, comporter au moins deux lignes et totaliser exactement le montant confirmé. Le serveur reste la source de vérité. |
| Paiements partiels | Si un règlement manuel précédent existe, sa ventilation est conservée et cumulée. Une commande qui devient totalement réglée possède donc une ventilation complète cohérente avec son total. |
| Stock et statut | Le comportement existant est préservé : stock décrémenté uniquement lorsque le règlement devient intégral ; statut mis à jour dans la même transaction que `paidAmount`. |
| Affichage / exports | Les ventilations incluant carte externe ou autre moyen restent lisibles dans l’admin et se répartissent correctement dans les exports/statistiques. Les factures et emails clients emploient l’intitulé générique **« Paiement divisé »**. |
| Base de données | Aucune migration : le champ JSON existant `posPaymentBreakdown` est réutilisé pour persister la ventilation contrôlée. |

## Garanties et limites

- Aucun secret ni identifiant sensible n’est ajouté au code.
- Aucun paiement automatique n’est simulé : cette action est réservée à un encaissement réellement constaté par l’administrateur.
- La commande reste protégée contre une ventilation invalide, un dépassement du solde ou une répartition héritée incohérente.
- Un ancien identifiant de paiement en ligne est neutralisé comme dans le flux manuel existant, afin qu’un webhook tardif ne remplace pas la confirmation administrative.
- Cette évolution n’active ni ne modifie de configuration de prestataire de paiement.

## Fichiers concernés

- `frontend/src/app/admin/commandes/[id]/page.tsx`
- `frontend/src/lib/admin-api.ts`
- `frontend/src/types/index.ts`
- `backend/src/routes/admin.ts`
- `backend/src/utils/manualPaymentBreakdown.ts`
- `backend/src/utils/manualPaymentBreakdown.test.ts`
- `backend/src/utils/posPaymentBreakdown.ts`
- `backend/src/utils/posPaymentBreakdown.test.ts`
- `backend/src/services/salesDashboardService.ts`
- `backend/src/routes/pos.ts`
- `backend/src/services/emailService.ts`
- `backend/src/services/b2cInvoiceService.ts`
- `backend/package.json`

## Validations exécutées

| Commande | Résultat |
|---|---|
| `cd backend && npx tsc --noEmit` | Succès |
| `cd frontend && npx tsc --noEmit` | Succès |
| `cd backend && npm run test:manual-payment-breakdowns` | Succès — ventilation carte externe + espèces, cas incomplets et totaux incorrects couverts |
| `cd backend && npm run test:pos-payments` | Succès — couverture ajoutée pour les moyens utilisés hors caisse |
| `cd backend && npm run test:sales-dashboard` | Succès |
| `cd backend && npm run test:finance-overview` | Succès |
| `cd frontend && pnpm lint` | Succès sans erreur ; avertissements historiques non bloquants présents dans le projet (images HTML et dépendances de hooks) |
| `git diff --check` | Succès |

## Vérification fonctionnelle recommandée après déploiement

1. Ouvrir une commande non POS en `pending` ou `pending_payment`.
2. Dans **Confirmer un paiement hors site**, choisir **Paiement divisé**.
3. Renseigner par exemple `200,00 €` par carte externe et le solde par espèces ; vérifier que l’état devient **Équilibré**.
4. Confirmer le paiement et vérifier : statut payé, montant encaissé égal au total, ventilation affichée dans le récapitulatif financier et stock décrémenté une seule fois.
5. Tester ensuite une commande partiellement réglée : effectuer un premier règlement unitaire puis solder avec un paiement divisé ; vérifier que la ventilation finale comprend les deux encaissements.
