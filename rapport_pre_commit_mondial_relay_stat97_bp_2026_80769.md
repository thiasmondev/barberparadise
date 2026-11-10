# Rapport pré-commit — Mondial Relay STAT 97, BP-2026-80769

**Le champ divergent est `Dest_Ad4`, le complément d’adresse « 3 » : l’ancien code signait cette valeur mais omettait le champ du SOAP. L’apostrophe typographique U+2019 n’est pas la cause de ce décalage.** Le défaut est reproduit localement avec une clé factice, puis corrigé en utilisant les mêmes paramètres normalisés pour signer et construire la requête.

Date : 10 novembre 2026. Auteur : Manus AI. Base auditée : commit `025adce` sur `main`. Rapport rédigé avant publication du correctif.

## Preuve sur le champ divergent

Le diagnostic fourni par Mathias atteste `STAT=97`, un échec le 10 novembre à 20:14:01 UTC, un poids de **2 420 g**, un relais `020965`, un code postal destinataire `30500` et expéditeur `57000`. La requête SQL fournie confirme le complément **`3`** et l’adresse client **`1 rue de l’église`**, avec U+2019.

Ce diagnostic historique ne contient pas les champs complets signés, ni la signature. Le commit `dd3ddfe` persistait un résumé de contexte et la réponse transporteur, pas tous les paramètres de la requête. Il n’a donc pas permis un recalcul historique avec la vraie clé ; aucune vraie clé n’a été lue, utilisée ou publiée dans cette enquête.

L’ancien service effectuait ces deux opérations différentes :

```ts
const destAd4 = normalizeMondialRelayText(input.recipient.extension || "", 32);
// Le tableau des valeurs MD5 contient destAd4 : "3".
// L’enveloppe n’écrit Dest_Ad4 que si destAd4.length >= 2 : champ omis.
```

L’essai local utilise le vrai service avant correction, un transport entièrement remplacé en mémoire et une clé synthétique. Les résultats sont :

- U+2019, complément vide : la signature correspond aux champs réellement envoyés.
- Apostrophe ASCII, complément vide : la signature correspond également.
- U+2019, complément `3` : la signature ne correspond pas aux champs envoyés.
- Apostrophe ASCII, complément `3` : le même écart apparaît.

Dans le cas avec complément `3`, recalculer en ajoutant précisément `Dest_Ad4=3` aux valeurs décodées du SOAP reproduit la signature initiale. Cela identifie ce champ, indépendamment du type d’apostrophe dans la rue.

L’ancien normaliseur supprimait U+2019, donnant `1 RUE DE LEGLISE`, avant le MD5 **et** avant le SOAP. C’était une conversion d’adresse imparfaite, mais cohérente entre les deux opérations. La corriger ne suffisait donc pas à résoudre le STAT 97 de ce cas.

La documentation WSI indique que `Expe_Ad4` et `Dest_Ad4` sont facultatifs, acceptent **0 à 32 caractères** et autorisent les chiffres. Un complément `3` n’a pas à être écarté. Les lignes obligatoires 1 et 3 sont limitées à 32 caractères avec un minimum de 2 ; la ville française est limitée à 26 caractères avec une whitelist différente. La signature doit concaténer les paramètres dans l’ordre documenté, y compris les paramètres facultatifs vides.[1]

## Correction de la requête

`backend/src/utils/mondialRelayRequest.ts` définit l’ordre des champs WSI2 et une normalisation par type de champ. Un seul objet de paramètres, gelé après normalisation, sert au calcul MD5 et à la sérialisation XML. L’échappement XML se fait seulement pour représenter ces mêmes valeurs ; il ne devient jamais une transformation des données signées.

Le complément `3` est désormais conservé dans `Dest_Ad4` et envoyé. Un complément vide reste une valeur vide dans la signature ; son champ peut être omis sans divergence. La même règle couvre les compléments expéditeur d’un caractère.

La normalisation d’expédition convertit les apostrophes `'`, `’`, `‘`, l’accent grave et l’accent aigu typographique vers une apostrophe ASCII. Elle convertit les guillemets français et typographiques, les tirets typographiques et les espaces insécables avant le filtrage ASCII. Elle décompose les accents, met les champs adresse en majuscules, applique la whitelist propre à la rue ou à la ville, réduit les apostrophes ASCII répétées et tronque aux longueurs documentées. La casse des e-mails n’est pas transformée. Les téléphones suivent la conversion française déjà utilisée.

Ces conversions sont limitées aux variables de la requête transporteur. L’adresse client stockée et affichée reste **`1 rue de l’église`**, le complément reste `3`, et la ville reste `Saint-Ambroix`. Aucun normaliseur ASCII d’expédition n’est appliqué à `ShippingAddress`, aux adresses du compte client ou aux snapshots d’adresse client des échanges.

## Diagnostic persisté sans secret

Le service ajoute `normalizedRequestParameters` au contexte de création d’étiquette : succès, réponse d’erreur transporteur et erreur réseau après construction de la requête. Cet objet contient les champs réellement signés et envoyés, dont les adresses, compléments, villes, codes postaux, poids et identifiant relais.

Cet objet **ne contient ni la clé privée, ni `Security`, ni l’enveloppe signée**. Les anciens logs `[MondialRelay][DIAG-V2]`, qui affichaient les coordonnées d’expéditeur et de destinataire en console, sont supprimés. Les données de diagnostic restent destinées à l’administration.

## Pourquoi le relais est stocké avec deux apostrophes

L’API publique de recherche Barber Paradise renvoyait déjà le 10 novembre à 20:19:51 UTC le relais `020965` avec `address="98 ROUTE D''ALES"` et la même valeur dans `fullAddress`. Cette valeur existe donc **avant** la sélection frontend et avant le stockage checkout. Un autre relais, `034378`, présente le même phénomène pour `D''UZES`.[2]

Dans le code audité, le parseur extrait directement `LgAdr3` de la réponse SOAP. Le frontend copie `fullAddress`, puis Prisma enregistre cette chaîne sans nettoyage. Aucun remplacement de `'` par `''` n’a été trouvé dans ce parcours. L’erreur démontrée est l’**absence de nettoyage à l’entrée et aux frontières d’écriture des données relais**, pas un échappement SQL manuel ajouté par Prisma.

L’origine exacte à l’intérieur du service amont Mondial Relay ne peut pas être démontrée sans sa réponse SOAP originale. Le fait que deux apostrophes soient présentes en base ne démontre pas que notre code les a créées : il les a laissées passer. Cette distinction est conservée dans le rapport au lieu de présenter une hypothèse comme une preuve.

Le correctif traite uniquement les chaînes d’affichage des **points relais** : réduction des apostrophes ASCII répétées, décodage correct des entités XML de la recherche et recomposition de l’adresse complète. Les frontières d’écriture checkout et échanges utilisent ce nettoyage ciblé pour éviter qu’une sélection déjà ouverte ou une autre entrée conserve un doublon. Les accents, les apostrophes simples et typographiques des textes affichés ne sont pas supprimés.

Le nom et l’adresse d’affichage du relais ne sont pas utilisés comme `Dest_Ad3` dans la création normale d’étiquette : le service reçoit l’adresse client et l’identifiant `LIV_Rel=020965`. Le nettoyage de `D''ALES` et la correction de `Dest_Ad4` sont donc deux corrections distinctes.

## Statut du précédent signalement STAT 39

La documentation définit **STAT 39 comme e-mail incorrect** et **STAT 97 comme clé de sécurité incorrecte**. Le lien entre l’ancienne adresse relais `D''ITALIE` et STAT 39 n’est pas établi par les preuves disponibles.[1]

`dd3ddfe` n’était pas un correctif STAT 39 : il introduisait la persistance des erreurs d’étiquette, avec un message particulier pour STAT 36. `b34b610` ajoutait la validation des e-mails au checkout et dans l’administration, ainsi que leur correction depuis la fiche commande ; il ne modifiait pas le parseur relais et ne nettoyait pas rétroactivement les anciens relais.

La validation des nouveaux e-mails a donc bien été livrée. Un correctif dédié au nettoyage des apostrophes des relais n’apparaît pas dans l’historique antérieur à cette livraison. La résolution réelle du précédent STAT 39 ne doit pas être affirmée sans un test de la commande concernée.

## Nettoyage ciblé des données existantes et comptages

La migration préparée pour cette livraison réduit les apostrophes répétées uniquement dans les champs d’affichage relais des commandes et des snapshots relais d’échanges. Elle ne modifie aucun paiement, montant, stock, PDF, numéro d’expédition ou identifiant de relais ; elle ne réécrit aucune adresse client.

Le script `backend/scripts/audit-mondial-relay-apostrophes.sql` est prévu pour compter séparément les adresses clients contenant deux apostrophes et les champs/snapshots de relais concernés. Les comptages sont en lecture seule. Les adresses clients sont **comptées mais pas corrigées automatiquement**, conformément à la conservation de la saisie originale.

**Les comptes réels de production sont inconnus dans cette session.** Mathias a refusé toute connexion Render ou Mondial Relay Connect. Une ligne de BP-2026-80769 est attestée par son export SQL, mais cela ne donne pas le nombre total de lignes concernées. Aucun comptage global ni nettoyage déjà exécuté en production n’est annoncé ici.

## Tests et conditions de livraison

Les tests locaux du constructeur et du vrai service recalculent le MD5 depuis le **XML réellement envoyé**, et non depuis une copie de l’objet source. Ils couvrent les apostrophes ASCII/typographiques, guillemets, accents, tirets, espaces insécables, adresses `l’église`, `D'Alès`, `D'Italie`, ville `Saint-Ambroix`, limites de longueur et compléments vides ou d’un caractère.

Le transport simulé vérifie également cinq parcours avec réponses **STAT 0 et PDF fictifs**, puis des erreurs STAT 97 et réseau. Les diagnostics ne contiennent ni clé synthétique ni `Security`. Les objets d’entrée restent inchangés. Ces essais n’ont fait aucun appel réel de création d’étiquette.

Les tests logistiques existants, les tests d’adresses, d’échanges, de remises, de tarifs professionnels, de validation des e-mails, du routeur de paiement et de paiements différés réussissent. Les nouveaux tests du nettoyage relais réussissent : six réponses SOAP fictives et deux erreurs, ainsi que les huit écritures relais checkout et les deux écritures de snapshots d’expédition d’échange. TypeScript backend, validation du schéma Prisma et **build backend complet** réussissent.

La migration SQL exacte et le comptage ont également été exécutés dans **PostgreSQL embarqué PGlite 0.5.16 / PostgreSQL 18.6**, sur des tables temporaires et des données synthétiques seulement. Le nettoyage transforme les doublons des quatre catégories relais en zéro ; les cinq catégories de données clients restent identiques, accents et apostrophes compris. Une seconde exécution ne modifie ni les valeurs ni la version de ligne `xmin` : l’idempotence et l’absence de réécriture inutile sont vérifiées par PostgreSQL. Ce résultat n’est pas un comptage ni un nettoyage de production. Un premier essai du lanceur local avait regroupé préparation et lecture seule dans le même appel SQL ; le lanceur a été corrigé pour respecter les frontières de fichiers/transactions de psql, puis l’essai exact a réussi sans changer la migration.

Commandes principales : `npm run test:mondial-relay-signature`, `npm run test:mondial-relay-display`, `npm run test:logistics`, `npm run test:shipping-addresses`, `npm run test:exchanges`, `npm run test:order-discounts`, `npm run test:professional-pricing`, `npm run test:draft-payments`, `npm run test:email-validation`, `npm run test:payments`, `npx tsc --noEmit`, `npm run build`. Le test SQL autonome est `backend/scripts/test-mondial-relay-apostrophes.sql`, prévu pour psql avec arrêt sur erreur et uniquement des tables temporaires.

Aucune variable Render, clé de production, activation de paiement ou configuration de cron n’est modifiée. Le rapport précède le commit et tout déploiement du correctif.

## Test restant sur BP-2026-80769

**Une étiquette réelle réussie sur BP-2026-80769 après déploiement n’est pas confirmée.** Sans connexion ni action du titulaire du compte, cette étape ne peut pas être exécutée ici. Il serait incorrect de confondre le STAT 0 du simulateur avec une réponse réelle de Mondial Relay.

Après déploiement backend et application de la migration, Mathias pourra relancer une seule création sur cette commande en conservant le poids **2 420 g**, le relais **020965** et le complément **3**. Si l’étiquette est créée, son numéro et le PDF permettront de confirmer cette dernière étape. Si elle échoue, l’objet `normalizedRequestParameters` permettra enfin de contrôler précisément les champs transmis, sans publier le hash ou la clé.

L’étiquette manuelle via Mondial Relay Connect n’a pas été créée, conformément au refus de connexion. Aucun achat, débit ni modification du statut d’expédition de cette commande n’a été effectué par cette session.

## References

[1]: https://www.mondialrelay.fr/media/87028/web-service-solution-v5.3.pdf "Mondial Relay — spécification WSI, formats adresse, ordre MD5 et codes 39/97"
[2]: https://barberparadise-backend.onrender.com/api/mondialrelay/points?cp=30500&country=FR&nb=10 "API publique Barber Paradise — recherche relais 30500, observation du 10 novembre 2026"
