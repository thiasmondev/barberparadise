# Rapport avant commit — Import clients Shopify

**Auteur : Manus AI**  
**Date : 2026-06-02**  
**Dépôt : `thiasmondev/barberparadise`**

Ce rapport documente les modifications réalisées pour ajouter un import Prisma des clients depuis le CSV Shopify, préparer les comptes à une réinitialisation de mot de passe obligatoire, et exposer une route admin séparée pour l’envoi massif des emails de réinitialisation. Aucun email n’est envoyé par le script d’import.

## Résumé fonctionnel

Le nouveau script `backend/scripts/importCustomers.ts` lit un export CSV Shopify et crée les clients absents en base de manière **idempotente**. Chaque client importé reçoit un mot de passe temporaire aléatoire, haché avec `bcryptjs`, sans jamais être logué, puis le champ `mustResetPassword` est positionné à `true` afin d’imposer une réinitialisation ultérieure. La préférence `Accepts Email Marketing` est conservée sur le client via `acceptsEmailMarketing`, et les clients opt-in sont également synchronisés dans `NewsletterSubscriber`.

La route admin `POST /api/admin/customers/send-reset-emails` envoie ensuite, séparément de l’import, des liens de réinitialisation aux clients ayant `mustResetPassword: true`. L’envoi utilise le service email existant via Resend et applique une temporisation de 100 ms entre deux emails, soit une limite maximale de **10 emails/seconde**.

| Élément | Implémentation |
|---|---|
| Script demandé | `backend/scripts/importCustomers.ts` |
| Commande cible | `npx ts-node scripts/importCustomers.ts customers_export.csv` |
| Idempotence | Vérification préalable par email avec `findUnique`; skip si le client existe déjà |
| Mot de passe temporaire | Généré aléatoirement, haché, jamais affiché dans les logs |
| Réinitialisation obligatoire | Nouveau champ `Customer.mustResetPassword Boolean @default(false)` |
| Préférence marketing | Nouveau champ `Customer.acceptsEmailMarketing Boolean @default(false)` + upsert newsletter si opt-in |
| Adresse Shopify | Création d’une `Address` liée si une adresse est présente dans le CSV |
| Comptes pro | Création d’un `ProAccount` approuvé si `Default Address Company` est renseigné |
| Envoi emails | Route admin séparée, pas d’envoi pendant l’import |

## Fichiers modifiés

| Fichier | Nature de la modification |
|---|---|
| `backend/prisma/schema.prisma` | Ajout des champs `mustResetPassword` et `acceptsEmailMarketing` sur le modèle `Customer`. |
| `backend/prisma/migrations/20260602110000_add_customer_import_flags/migration.sql` | Migration SQL ajoutant les deux colonnes avec `DEFAULT false`. |
| `backend/scripts/importCustomers.ts` | Nouveau script d’import CSV Shopify avec logs succès / skip / erreur et résumé final. |
| `backend/src/routes/admin.ts` | Ajout de `POST /api/admin/customers/send-reset-emails`, génération de tokens de reset, envoi Resend limité à 10 emails/seconde. |
| `backend/src/routes/auth.ts` | Lors d’une réinitialisation réussie, passage de `mustResetPassword` à `false`. |
| `RAPPORT_IMPORT_CLIENTS_SHOPIFY.md` | Présent rapport obligatoire avant commit. |

## Détails d’import

Pour chaque ligne CSV, le script normalise l’email en minuscules, vérifie l’existence du client, puis crée uniquement les comptes absents. Si une adresse est détectée à partir des colonnes Shopify `Default Address ...`, elle est créée comme adresse par défaut. Si la colonne `Default Address Company` est renseignée, un compte professionnel est créé pour conserver l’information B2B issue de Shopify.

| Colonne Shopify | Destination |
|---|---|
| `First Name`, `Last Name`, `Email` | `Customer.firstName`, `Customer.lastName`, `Customer.email` |
| `Default Address Phone` | `Customer.phone` et téléphone du `ProAccount` si compte pro |
| `Default Address Address1`, `Address2`, `City`, `Province Code`, `Country Code`, `Zip` | `Address` liée au client |
| `Default Address Company` | `ProAccount.companyName`, déclenche la création d’un compte pro |
| `Total Spent`, `Total Orders` | Mentionnés dans `ProAccount.activity` pour contextualiser l’import |
| `Accepts Email Marketing` | `Customer.acceptsEmailMarketing` et `NewsletterSubscriber` si opt-in |

## Sécurité et confidentialité

Le script ne logue ni mot de passe temporaire, ni token de réinitialisation. Les logs opérationnels restent limités au statut d’import par email : `SUCCESS`, `SKIP` ou `ERREUR`. Les emails ne sont pas envoyés pendant l’import, conformément à la contrainte, et la route admin d’envoi massif reste protégée par le middleware admin existant.

## Validations effectuées

| Validation | Résultat |
|---|---|
| `cd backend && npx prisma format && npx prisma generate` | Succès |
| `cd backend && npm run build` | Succès |
| `cd backend && npx tsc --noEmit --module commonjs --target ES2020 --esModuleInterop --skipLibCheck --strict --types node scripts/importCustomers.ts` | Succès |
| Smoke test CLI avec CSV absent | Succès : le script détecte le fichier manquant proprement et affiche l’usage attendu |
| `git diff --check` | Succès |

## Commandes d’exploitation

Pour importer le fichier Shopify après déploiement de la migration, il faut placer le CSV à l’emplacement souhaité côté backend puis exécuter :

```bash
cd backend
npx ts-node scripts/importCustomers.ts customers_export.csv
```

Pour déclencher l’envoi groupé des liens de réinitialisation après import, il faut appeler la route admin protégée :

```bash
POST /api/admin/customers/send-reset-emails
```

La route renvoie un résumé JSON contenant notamment `totalEligible`, `sent`, `skipped`, `errors`, `failedCustomerIds` et `rateLimit`.
