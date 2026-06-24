# Rapport Pré-commit — Bug PayPal (Statut "En attente")

## 1. Findings de l'audit du flux PayPal

L'audit complet du code d'intégration PayPal (`checkout.ts` et `webhooks.ts`) a révélé deux problèmes majeurs expliquant pourquoi les commandes restent en statut "En attente".

### Problème 1 : L'étape de Capture est manquante
L'intégration PayPal utilise l'API `v2/checkout/orders` avec l'intention `CAPTURE`.
Cependant, dans ce flux, PayPal s'attend à ce que le marchand déclenche explicitement l'appel de capture une fois que le client a approuvé le paiement.
- Actuellement, le client approuve le paiement sur la page PayPal et est redirigé vers la page de succès frontend (`/commande/succes?orderId=...`).
- **Aucun appel à l'API de capture** n'est fait par le backend Barber Paradise au retour du client.
- Sans cette capture, la transaction reste au statut `APPROVED` côté PayPal, mais les fonds ne sont pas capturés, et PayPal n'envoie pas l'événement webhook `PAYMENT.CAPTURE.COMPLETED`.

### Problème 2 : Architecture du webhook PayPal
Le webhook PayPal (dans `webhooks.ts`) est censé écouter l'événement `PAYMENT.CAPTURE.COMPLETED`.
- Le handler webhook PayPal **n'a pas encore été mis à jour** avec la nouvelle architecture asynchrone qui a corrigé le bug Mollie.
- Le webhook Mollie répond immédiatement `200 OK` puis exécute les effets secondaires (stock, facture, email) de manière asynchrone et sécurisée.
- Le webhook PayPal actuel attend que la transaction en base de données (`markOrderPaid`) se termine avant de répondre à PayPal, ce qui l'expose au même risque de timeout et d'erreur 500 que l'ancien webhook Mollie.

## 2. Corrections prévues

### A. Implémentation de la Capture PayPal
Je vais créer une nouvelle route backend `GET /api/checkout/paypal/capture` qui servira de `return_url` (URL de retour) pour PayPal :
1. Le client paie sur PayPal.
2. PayPal redirige le client vers `GET /api/checkout/paypal/capture?token=...&orderId=...`.
3. Le backend Barber Paradise appelle l'API PayPal `POST /v2/checkout/orders/{token}/capture` pour capturer les fonds.
4. Une fois capturé avec succès, le backend met à jour le statut de la commande en `paid` (via `markOrderPaid` et `runPostPaymentEffects`) et redirige le client vers la page de succès frontend.

### B. Refactoring du Webhook PayPal
Bien que la capture immédiate gère la mise à jour de la commande, le webhook reste un filet de sécurité essentiel. Je vais :
1. Ajouter des logs détaillés `[webhook][paypal]` à chaque étape (comme pour Mollie).
2. Appliquer le pattern de réponse immédiate `res.json({ received: true })` avant de lancer les effets secondaires asynchrones.

Ces deux corrections garantiront que les paiements PayPal sont correctement capturés et que le statut de la commande passe à "Payé" instantanément.
