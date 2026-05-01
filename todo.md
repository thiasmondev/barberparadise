# Project TODO

- [x] Ajouter la suppression sécurisée d’une marque dans le panel admin avec confirmation obligatoire, cascade sur produits liés, avis et variantes, endpoint de statistiques préalable, toast de confirmation et carousel de marques dynamique sur la page d’accueil.
- [x] Corriger l’erreur d’upload logo/bannière dans la modale admin des marques et valider que le média enregistré reste utilisable après sauvegarde.
- [x] Créer le contexte CustomerAuthContext avec JWT localStorage, hydratation via GET /api/customers/me, login, logout et register.
- [x] Créer la page /connexion avec validation email/mot de passe, message d’erreur, lien inscription et redirection vers /compte.
- [x] Créer la page /inscription avec validation complète, confirmation de mot de passe, lien connexion et redirection vers /compte.
- [x] Créer la page protégée /compte avec onglets informations, commandes, adresses et wishlist connectés aux routes client existantes.
- [x] Mettre à jour le header pour envoyer vers /connexion si non connecté et afficher un dropdown compte si connecté.
- [x] Ajouter les tests de régression frontend pour l’authentification client et exécuter les vérifications avant push GitHub.
- [x] Compléter si nécessaire les endpoints client manquants GET /api/customers/me/orders, GET/POST/DELETE /api/customers/me/addresses pour rendre la page /compte réellement fonctionnelle.
- [ ] Corriger l’échec de build Vercel au pré-rendu de /compte et sécuriser les pages client contre les erreurs de rendu statique Next.js.

- [x] Corriger le build Next.js en production lié aux hooks de navigation App Router et au pré-rendu.
- [x] Rendre les adresses du compte client cliquables et modifiables avec sauvegarde des changements.
- [x] Ajouter la possibilité d’ajouter/retirer un produit en wishlist depuis les fiches produit et l’afficher dans l’onglet wishlist du compte.
- [x] Tester les routes backend auth/compte Render avec curl et documenter les statuts HTTP ainsi que les JSON complets.
- [x] Ajouter un encadré « Extension » sous le formulaire d’adresse dans l’onglet Mes adresses du compte.
- [x] Intégrer le système de paiement multi-PSP avec commandes Prisma, routage Mollie/PayPal/Fintecture/GoCardless/Checkout.com, webhooks sécurisés, frontend panier et pages de confirmation/annulation.
- [x] Aligner l’intégration paiement avec le document B2B/B2C : méthodes autorisées par type client, méthode `sepa`, routage PSP, pages succès/annulation, variables Render et validations complètes.
- [x] Exécuter les dernières instructions envoyées dans pasted_content_3.txt et aligner l’intégration paiement BarberParadise en conséquence.
