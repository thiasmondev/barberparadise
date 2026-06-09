# Rapport pré-commit — Système d’alertes de retour en stock

## Synthèse

Le système **“Prévenez-moi quand c’est en stock”** a été implémenté dans le dépôt `thiasmondev/barberparadise` sans commit ni push à ce stade. L’intégration couvre le modèle Prisma, la route publique d’inscription, les routes admin, le déclenchement automatique lors d’un passage de stock de `0` à une valeur positive, l’envoi Resend avec limitation à **50 emails par minute**, le formulaire inline sur la fiche produit et une section d’administration dans `/admin/stock`.

## Fichiers modifiés ou ajoutés

| Fichier | Statut | Rôle |
|---|---:|---|
| `backend/prisma/schema.prisma` | Modifié | Ajout du modèle `StockAlert`, relation produit/variante, indexes et champ `notifiedAt`. |
| `backend/prisma/migrations/20260609100000_add_stock_alerts/migration.sql` | Ajouté | Migration SQL créant la table `StockAlert`, les clés étrangères, l’unicité email/produit/variante et les index. |
| `backend/src/index.ts` | Modifié | Montage de la route publique `/api/stock-alerts`. |
| `backend/src/routes/stock-alerts.ts` | Ajouté | Route publique `POST /api/stock-alerts` avec validation email, vérification produit/variante et gestion du doublon. |
| `backend/src/routes/admin.ts` | Modifié | Routes admin `GET /api/admin/stock-alerts`, `DELETE /api/admin/stock-alerts/:id`, notification manuelle et déclencheurs automatiques sur mise à jour stock produit, variante et import PDF. |
| `backend/src/services/stockAlertService.ts` | Ajouté | Service de notification, détection `0 -> >0`, rate limiting 50/min, marquage `notified=true` uniquement après envoi effectif. |
| `backend/src/services/emailService.ts` | Modifié | Ajout de `sendStockAlertEmail` via Resend avec l’objet demandé. |
| `backend/src/emails/stockAlert.ts` | Ajouté | Template email de retour en stock avec image, nom, prix, CTA et texte de relance. |
| `frontend/src/lib/api.ts` | Modifié | Helper public `createStockAlert`. |
| `frontend/src/lib/admin-api.ts` | Modifié | Types et helpers admin pour lister, supprimer et notifier une alerte. |
| `frontend/src/components/ProductDetail.tsx` | Modifié | Bouton “Me prévenir quand c’est en stock”, formulaire email inline, préremplissage client connecté, messages de confirmation/doublon et sélection possible des variantes en rupture. |
| `frontend/src/app/admin/stock/page.tsx` | Modifié | Section admin avec compteur d’alertes en attente, tableau produit/email/date/statut et actions “Notifier manuellement” / “Supprimer”. |

## Comportements implémentés

| Exigence | Statut |
|---|---:|
| Bouton sur fiche produit lorsque le produit ou la variante est en rupture | Implémenté |
| Formulaire inline avec champ email et bouton “M’alerter” | Implémenté |
| Email pré-rempli si client connecté | Implémenté |
| Confirmation après inscription | Implémenté |
| Message spécifique si l’email est déjà inscrit | Implémenté côté API et affiché côté frontend |
| Modèle Prisma `StockAlert` et migration | Implémenté |
| Route publique `POST /api/stock-alerts` | Implémenté |
| Routes admin de liste et suppression | Implémenté |
| Notification manuelle admin | Implémenté |
| Déclenchement automatique lors d’un passage stock `0 -> >0` | Implémenté sur produit, variante et import PDF stock |
| Email Resend avec image, nom, prix et CTA | Implémenté |
| Expéditeur `noreply@barberparadise.fr` par défaut | Implémenté via `FROM_EMAIL` ou fallback |
| Rate limiting 50 emails/minute | Implémenté dans le service d’envoi |
| Pas de doublon si `notified=true` | Implémenté |

## Validations exécutées

| Commande | Résultat |
|---|---:|
| `DATABASE_URL='postgresql://user:pass@localhost:5432/barberparadise' npx prisma validate` | Réussi |
| `DATABASE_URL='postgresql://user:pass@localhost:5432/barberparadise' npm run build` dans `backend` | Réussi |
| `npm run build` dans `frontend` | Réussi |
| `git diff --check` | Réussi, aucune erreur d’espaces |

## Points d’attention avant commit

Le système est prêt pour commit, mais **aucun commit ni push n’a été effectué** conformément à la contrainte de validation préalable. La migration devra être appliquée sur l’environnement cible via le processus habituel de déploiement Prisma. En production, l’envoi dépend de `RESEND_API_KEY` et de la validation du domaine expéditeur `noreply@barberparadise.fr` côté Resend.
