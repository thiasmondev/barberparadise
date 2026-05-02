export type LegalBlockKind = "heading1" | "heading2" | "heading3" | "paragraph" | "list_item";

export interface LegalBlock {
  kind: LegalBlockKind;
  text: string;
}

export interface LegalPageContent {
  title: string;
  intro: string;
  sources: string[];
  blocks: LegalBlock[];
}

export const legalPages = {
  "cgv": {
    "title": "Conditions générales",
    "intro": "Conditions d’utilisation et procédure de retour de Barber Paradise, reprises depuis les pages légales existantes puis nettoyées des éléments de navigation.",
    "sources": [
      "https://www.barberparadise.fr/policies/terms-of-service",
      "https://www.barberparadise.fr/policies/refund-policy"
    ],
    "blocks": [
      {
        "kind": "heading2",
        "text": "Conditions d’utilisation"
      },
      {
        "kind": "paragraph",
        "text": "Conditions Générales d'Utilisation (CGU) de Barber Paradise"
      },
      {
        "kind": "paragraph",
        "text": "Bienvenue sur Barber Paradise, où nous proposons une gamme variée de produits de coiffure et de soins et matériel spécialisé coiffure barber. Notre objectif est de fournir à nos utilisateurs des produits de haute qualité qui répondent à leurs besoins de soin et d'esthétique personnels et de professionnels de la coiffure et barbier."
      },
      {
        "kind": "paragraph",
        "text": "Les présentes Conditions Générales d'Utilisation (« CGU ») sont destinées à établir les termes légaux et conditions sous lesquels vous pouvez utiliser le site www.barberparadise.fr . Ces CGU sont importantes tant pour vous, en tant qu'utilisateur, que pour nous, en tant qu'entreprise."
      },
      {
        "kind": "paragraph",
        "text": "Nous vous encourageons à lire attentivement ces CGU avant d'utiliser notre site. En utilisant notre site, vous acceptez d'être lié par les termes énoncés ci-après, ainsi que par notre politique de confidentialité."
      },
      {
        "kind": "paragraph",
        "text": "Article 1. Objet"
      },
      {
        "kind": "paragraph",
        "text": "Le présent document définit les CGU applicables à l'utilisation du site www.barberparadise.fr . Ces conditions régissent les relations entre Barber Paradise et ses utilisateurs dans le cadre de l'utilisation des services en ligne."
      },
      {
        "kind": "paragraph",
        "text": "Article 2. Utilisation du Site"
      },
      {
        "kind": "paragraph",
        "text": "Pour utiliser le site www.barberparadise.fr, suivez ces étapes simples :"
      },
      {
        "kind": "list_item",
        "text": "Navigation : Parcourez notre catalogue et découvrez les produits que nous proposons ;"
      },
      {
        "kind": "list_item",
        "text": "Sélection : Ajoutez les produits que vous souhaitez acheter à votre panier ;"
      },
      {
        "kind": "list_item",
        "text": "Informations de livraison : Indiquez l'adresse où vous souhaitez que votre commande soit livrée ;"
      },
      {
        "kind": "list_item",
        "text": "Paiement : Sélectionnez votre mode de paiement et remplissez les informations nécessaires pour finaliser votre commande."
      },
      {
        "kind": "paragraph",
        "text": "Article 3. Contrat et livraison des produits"
      },
      {
        "kind": "paragraph",
        "text": "Lorsqu'un utilisateur passe une commande sur www.barberparadise.fr, un contrat est automatiquement formé dès la finalisation du processus de paiement. La commande sera ensuite traitée selon les modalités suivantes :"
      },
      {
        "kind": "list_item",
        "text": "Confirmation de commande : Vous recevrez un email de confirmation récapitulant votre commande et les informations de livraison ;"
      },
      {
        "kind": "list_item",
        "text": "Préparation et expédition : Votre commande sera préparée et expédiée selon les options de livraison choisies. Nous nous engageons à expédier les produits dans les délais indiqués lors de votre commande ;"
      },
      {
        "kind": "list_item",
        "text": "Suivi de livraison : Vous recevrez un numéro de suivi pour suivre l'avancement de la livraison de votre commande ;"
      },
      {
        "kind": "list_item",
        "text": "Réception des produits : Vérifiez l'état des produits lors de la réception pour signaler immédiatement toute anomalie liée au transport."
      },
      {
        "kind": "paragraph",
        "text": "Article 4. Prix"
      },
      {
        "kind": "paragraph",
        "text": "Le prix de chaque produit est indiqué sur les pages correspondantes du site www.barberparadise.fr. Tous les prix sont affichés clairement et incluent la taxe sur la valeur ajoutée (TVA) applicable. Les prix des produits sont indiqués en euros et comprennent toutes les taxes, mais excluent les frais de livraison, sauf indication contraire."
      },
      {
        "kind": "paragraph",
        "text": "Article 5. Frais de Livraison"
      },
      {
        "kind": "paragraph",
        "text": "5.1 Les frais de livraison standard et les options de livraison express sont indiqués lors du processus de commande. Ces frais varient en fonction du poids et de la taille de la commande, de la destination de livraison et du mode de livraison choisi."
      },
      {
        "kind": "paragraph",
        "text": "5.2 Une fois que le transporteur a confirmé la livraison du colis à l'adresse spécifiée par l'utilisateur, la responsabilité de www.barberparadise.fr concernant la sécurité et l'intégrité du colis est considérée comme remplie. En cas de réclamation pour non-réception du colis, il est de la responsabilité de l'utilisateur de fournir une preuve que le colis n’a pas été reçu malgré l'indication de livraison par le transporteur. Les utilisateurs sont encouragés à contacter le service client pour assistance en cas de problèmes de livraison, mais www.barberparadise.fr ne sera pas tenu responsable des colis perdus ou volés après que la confirmation de livraison a été enregistrée par le transporteur."
      },
      {
        "kind": "paragraph",
        "text": "Article 6. Paiement"
      },
      {
        "kind": "paragraph",
        "text": "Le paiement est exigé au moment de la confirmation de la commande. Barber Paradise propose plusieurs méthodes de paiement sécurisées pour faciliter votre achat :"
      },
      {
        "kind": "list_item",
        "text": "Carte de Crédit : Visa, MasterCard, American Express ;"
      },
      {
        "kind": "list_item",
        "text": "PayPal : Utilisez votre compte PayPal pour un paiement rapide et sécurisé."
      },
      {
        "kind": "paragraph",
        "text": "Article 7. Droit de rétractation"
      },
      {
        "kind": "paragraph",
        "text": "7.1 Conformément aux articles L.221-18 à L.221-28 du Code de la consommation français, vous bénéficiez d'un droit de rétractation vous permettant de renoncer à votre achat sans donner de motif. Ce droit peut être exercé dans un délai de quatorze jours à compter de la réception du dernier bien commandé."
      },
      {
        "kind": "paragraph",
        "text": "7.2 Pour exercer ce droit de rétractation, vous devez notifier www.barberparadise.fr avant la fin du délai de rétractation de votre décision de rétracter le contrat. Cette notification doit être faite via une déclaration dénuée d’ambiguïté."
      },
      {
        "kind": "paragraph",
        "text": "7.3 Après nous avoir informés de votre décision de vous rétracter du contrat, vous devez renvoyer le bien, à vos frais, au 31 Rue de Pont-à-Mousson, 57950 Montigny-lès-Metz sans retard excessif et, en tout état de cause, au plus tard quatorze jours après que vous nous avez communiqué votre décision de rétractation du présent contrat. Ce délai est réputé respecté si vous renvoyez le bien avant l'expiration du délai de quatorze jours."
      },
      {
        "kind": "paragraph",
        "text": "7.4 Le droit de rétractation ne s'applique pas à l'achat de produits qui, par nature, ne peuvent être renvoyés ou sont susceptibles de se détériorer ou de se périmer rapidement. Cela inclut, sans s'y limiter, les produits consommables tels que les cires et les produits de soin qui ont été descellés après la livraison."
      },
      {
        "kind": "paragraph",
        "text": "Nous rappelons que pour les produits défectueux ou non conformes, les utilisateurs ont le droit de demander un échange ou un remboursement en vertu des garanties légales de conformité et des vices cachés et conformément à notre procédure de retour disponible sur notre site internet."
      },
      {
        "kind": "paragraph",
        "text": "Article 8. Remboursement"
      },
      {
        "kind": "paragraph",
        "text": "8.1 Suite à votre rétractation ou à votre retour de produit, Barber Paradise procédera au remboursement du montant total de la commande, y compris les frais de livraison initiaux, dans les 14 jours suivant la date à laquelle nous sommes informés de votre décision de vous rétracter. Le remboursement sera effectué en utilisant le même moyen de paiement que celui utilisé lors de la transaction initiale, sauf si vous convenez expressément d'un moyen différent."
      },
      {
        "kind": "paragraph",
        "text": "8.2 Dans le cas où le produit retourné n'est pas dans le même état que lorsqu'il a été reçu, une dépréciation du produit peut être déduite du montant remboursé."
      },
      {
        "kind": "paragraph",
        "text": "Article 9. Propriété intellectuelle"
      },
      {
        "kind": "paragraph",
        "text": "9.1 Barber Paradise est le détenteur légitime des droits de propriété intellectuelle ou industrielle liés au site web Barber Paradise, y compris, mais sans s'y limiter, les pages qu'il contient, les informations ou éléments contenus dans les textes, documents, photographies, dessins, graphiques, bases de données, logiciels, logos, marques, noms commerciaux ou autres éléments. Ces droits de propriété intellectuelle s'étendent à la mise en forme, à la sélection, à l'ordonnancement et à la présentation des contenus et matériaux disponibles sur ce site."
      },
      {
        "kind": "paragraph",
        "text": "9.2 Concernant les produits vendus, Barber Paradise distribue des produits qui peuvent également être protégés par des droits de propriété intellectuelle appartenant à des fournisseurs tiers ou à d'autres détenteurs de marques. Aucun contenu de ce site ne doit être interprété comme accordant, implicitement ou autrement, une licence ou un droit d'utiliser une quelconque marque ou autre propriété intellectuelle affichée sur le site sans l'autorisation écrite de Barber Paradise ou du tiers propriétaire des droits."
      },
      {
        "kind": "paragraph",
        "text": "9.3 Sauf autorisation expresse préalable de Barber Paradise ou des tiers détenant les droits correspondants, ou sauf disposition légale autorisant de telles actions, l’utilisateur du site ne peut reproduire, transformer, modifier, décoder, distribuer, louer, prêter, mettre à disposition ou permettre l’accès au public à travers toute forme de communication publique de l’un des éléments mentionnés précédemment. Cela inclut également les produits dont les droits de propriété intellectuelle appartiennent à des tiers, lesquels doivent être utilisés conformément aux conditions spécifiées par les détenteurs des droits."
      },
      {
        "kind": "paragraph",
        "text": "Article 10. Protection des données personnelles"
      },
      {
        "kind": "paragraph",
        "text": "10.1 Barber Paradise s'engage à protéger la vie privée de ses utilisateurs et à traiter les données personnelles dans le strict respect des lois en vigueur sur la protection des données personnelles, y compris le Règlement Général sur la Protection des Données (RGPD). Nous collectons, utilisons, et conservons vos données personnelles exclusivement pour des fins spécifiées dans notre politique de confidentialité, laquelle décrit en détail comment et pourquoi nous traitons vos données, ainsi que les droits dont vous disposez à cet égard."
      },
      {
        "kind": "paragraph",
        "text": "10.2 Pour obtenir de plus amples informations sur la manière dont vos données personnelles sont traitées, ainsi que sur les mesures que nous mettons en place pour garantir leur protection, nous vous invitons à consulter notre Politique de confidentialité."
      },
      {
        "kind": "paragraph",
        "text": "Article 11. Responsabilité et garanties"
      },
      {
        "kind": "paragraph",
        "text": "11.1 Barber Paradise s'engage à fournir des produits conformes aux normes en vigueur en France et respectant les dispositions légales françaises et européennes. Toutefois, notre responsabilité ne pourra être engagée en cas de non-respect des législations du pays où les produits sont livrés, qu'il appartient à l'acheteur de vérifier."
      },
      {
        "kind": "paragraph",
        "text": "11.2 Tous les produits fournis par Barber Paradise bénéficient de la garantie légale de conformité prévue par les articles L.217-4 à L.217-12 du Code de la consommation et de la garantie des vices cachés prévue par les articles 1641 à 1649 du Code civil."
      },
      {
        "kind": "heading2",
        "text": "Politique de remboursement et procédure de retour"
      },
      {
        "kind": "paragraph",
        "text": "Étape 1 : Notification de retour"
      },
      {
        "kind": "paragraph",
        "text": "Pour initier un retour, le client doit contacter le service client de Barber Paradise dans un délai de 14 jours suivant la réception du produit. Ceci peut être fait à l’adresse mail suivante : contact@barberparadise.fr . Le client devra fournir les détails de l'achat, y compris le numéro de commande, les raisons du retour et la préférence entre un remboursement ou un échange."
      },
      {
        "kind": "paragraph",
        "text": "Étape 2 : Confirmation de retour"
      },
      {
        "kind": "paragraph",
        "text": "Une fois la demande de retour reçue, Barber Paradise examinera la validité de la demande et, si elle est approuvée, fournira au client un numéro d'autorisation de retour et des instructions sur la manière de retourner le produit. Il est important que le produit soit retourné dans son emballage d'origine, accompagné de tous les accessoires et documents fournis."
      },
      {
        "kind": "paragraph",
        "text": "Étape 3 : Envoi du produit"
      },
      {
        "kind": "paragraph",
        "text": "Le client est responsable de l'envoi du produit à l'adresse indiquée par Barber Paradise. Nous recommandons d'utiliser un service de courrier qui permet de suivre l'envoi, car Barber Paradise ne peut être tenu responsable des colis perdus ou endommagés pendant le transport de retour."
      },
      {
        "kind": "paragraph",
        "text": "Étape 4 : Inspection du retour"
      },
      {
        "kind": "paragraph",
        "text": "À réception du produit retourné, notre équipe inspectera l'article pour vérifier son état et s'assurer que les conditions de retour sont remplies. Cette vérification comprend la conformité du produit, la présence de défauts non signalés, et la vérification que le produit n'a pas été utilisé de manière inappropriée."
      },
      {
        "kind": "paragraph",
        "text": "Étape 5 : Traitement de la demande de retour"
      },
      {
        "kind": "paragraph",
        "text": "Si le produit est validé pour un retour selon les critères de nos conditions générales de vente, Barber Paradise procédera selon la préférence du client :"
      },
      {
        "kind": "list_item",
        "text": "Remboursement : Un remboursement du montant payé lors de la commande, moins les frais de port avancés par Barber Paradise pour l’acheminement de la dite commande, sera effectué sur le mode de paiement original dans un délai de 14 jours ;"
      },
      {
        "kind": "list_item",
        "text": "Échange : Un produit de remplacement sera envoyé au client selon la disponibilité de l'article en stock."
      },
      {
        "kind": "paragraph",
        "text": "Étape 6 : Clôture du retour"
      },
      {
        "kind": "paragraph",
        "text": "Une fois le retour traité, Barber Paradise informera le client par mail ou par téléphone que la procédure de retour est complète."
      }
    ]
  },
  "mentionsLegales": {
    "title": "Mentions légales",
    "intro": "Informations d’édition, d’hébergement, de propriété intellectuelle et de contact relatives au site Barber Paradise.",
    "sources": [
      "https://www.barberparadise.fr/policies/legal-notice"
    ],
    "blocks": [
      {
        "kind": "heading1",
        "text": "Mentions légales"
      },
      {
        "kind": "paragraph",
        "text": "Mentions Légales de Barber Paradise"
      },
      {
        "kind": "paragraph",
        "text": "1. Éditeur du Site"
      },
      {
        "kind": "paragraph",
        "text": "Le site www.barberparadise.fr (ci-après dénommé « le Site ») est édité par la société Barber Paradise, société par actions simplifiée (SAS) au capital de 1000€, immatriculée au Registre du Commerce et des Sociétés de Metz sous le numéro 98262764800016 , dont le siège social est situé au 31 Rue de Pont-à-Mousson, 57950 Montigny-lès-Metz."
      },
      {
        "kind": "list_item",
        "text": "Nom de la société : Barber Paradise"
      },
      {
        "kind": "list_item",
        "text": "Forme juridique : SAS"
      },
      {
        "kind": "list_item",
        "text": "Capital social : 1000€"
      },
      {
        "kind": "list_item",
        "text": "RCS : 982627648 RCS Metz"
      },
      {
        "kind": "list_item",
        "text": "Siège social : 31 Rue de Pont-à-Mousson, 57950 Montigny-lès-Metz"
      },
      {
        "kind": "list_item",
        "text": "Téléphone : 07 56 80 55 89"
      },
      {
        "kind": "list_item",
        "text": "Email : contact@barberparadise.com"
      },
      {
        "kind": "paragraph",
        "text": "2. Hébergement du Site"
      },
      {
        "kind": "paragraph",
        "text": "Le site Barber Paradise est hébergé par OVH, dont le siège social est situé à 2 rue Kellermann - 59100 Roubaix - France"
      },
      {
        "kind": "list_item",
        "text": "Nom de l'hébergeur : OVH"
      },
      {
        "kind": "list_item",
        "text": "Adresse : 2 rue Kellermann - 59100 Roubaix - France"
      },
      {
        "kind": "list_item",
        "text": "Téléphone : 1007"
      },
      {
        "kind": "list_item",
        "text": "Site web : OVHCLOUD.COM"
      },
      {
        "kind": "paragraph",
        "text": "3. Propriété Intellectuelle"
      },
      {
        "kind": "paragraph",
        "text": "L'ensemble du contenu présent sur le site Barber Paradise, incluant, de manière non limitative, les graphismes, images, textes, vidéos, animations, sons, logos, gifs et icônes ainsi que leur mise en forme sont la propriété exclusive de la société Barber Paradise à l'exception des marques, logos ou contenus appartenant à d'autres sociétés partenaires ou auteurs."
      },
      {
        "kind": "paragraph",
        "text": "Toute reproduction, distribution, modification, adaptation, retransmission ou publication, même partielle, de ces différents éléments est strictement interdite sans l'accord exprès par écrit de Barber Paradise. Cette représentation ou reproduction, par quelque procédé que ce soit, constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle. Le non-respect de cette interdiction constitue une contrefaçon pouvant engager la responsabilité civile et pénale du contrefacteur."
      },
      {
        "kind": "paragraph",
        "text": "4. Données Personnelles"
      },
      {
        "kind": "paragraph",
        "text": "Barber Paradise s'engage à ce que la collecte et le traitement de vos données, effectués à partir du site Barber Paradise, soient conformes au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés."
      },
      {
        "kind": "paragraph",
        "text": "Pour toute information ou exercice de vos droits Informatique et Libertés sur les traitements de données personnelles gérés par Barber Paradise, vous pouvez contacter notre délégué à la protection des données (DPO) :"
      },
      {
        "kind": "list_item",
        "text": "Email : dpo@barberparadise.fr"
      },
      {
        "kind": "list_item",
        "text": "Adresse : 31 Rue de Pont-à-Mousson, 57950 Montigny-lès-Metz"
      },
      {
        "kind": "paragraph",
        "text": "5. Limitation de Responsabilité"
      },
      {
        "kind": "paragraph",
        "text": "Barber Paradise s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur ce site. Barber Paradise décline toute responsabilité pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur le site, ainsi que pour tout dommage résultant d'une intrusion frauduleuse d'un tiers ayant entraîné une modification des informations mises à disposition sur le site."
      },
      {
        "kind": "paragraph",
        "text": "Barber Paradise ne saurait être tenu pour responsable de tout dommage direct ou indirect, quelles qu'en soient les causes, origines, natures ou conséquences, provoqué à raison de l'accès de quiconque au site ou de l'impossibilité d'y accéder, de même que l'utilisation du site et/ou du crédit accordé à une quelconque information provenant directement ou indirectement de ce dernier."
      },
      {
        "kind": "paragraph",
        "text": "6. Liens Hypertextes"
      },
      {
        "kind": "paragraph",
        "text": "Le site Barber Paradise peut contenir des liens hypertextes vers d'autres sites présents sur le réseau Internet. Les liens vers ces autres ressources vous font quitter le site Barber Paradise. Il est possible de créer un lien vers la page de présentation de ce site sans autorisation expresse de Barber Paradise. Aucune autorisation ou demande d’information préalable ne peut être exigée par Barber Paradise à l’égard d’un site qui souhaite établir un lien vers le site de Barber Paradise. Il convient toutefois d’afficher ce site dans une nouvelle fenêtre du navigateur. Cependant, Barber Paradise se réserve le droit de demander la suppression d’un lien qu’il estime non conforme à l’objet du site Barber Paradise."
      },
      {
        "kind": "paragraph",
        "text": "7. Droit Applicable et Compétence"
      },
      {
        "kind": "paragraph",
        "text": "Les présentes mentions légales sont régies par le droit français. En cas de litige et à défaut de solution amiable, le litige sera porté devant les tribunaux français conformément aux règles de compétence en vigueur."
      },
      {
        "kind": "paragraph",
        "text": "8. Contact"
      },
      {
        "kind": "paragraph",
        "text": "Pour toute question, information sur les produits présentés sur le site, ou concernant le site lui-même, vous pouvez laisser un message à l'adresse suivante : contact@barberparadise.com ."
      }
    ]
  },
  "politiqueConfidentialite": {
    "title": "Politique de confidentialité",
    "intro": "Informations relatives à la collecte, au traitement, à la conservation et aux droits liés aux données personnelles.",
    "sources": [
      "https://www.barberparadise.fr/policies/privacy-policy"
    ],
    "blocks": [
      {
        "kind": "heading1",
        "text": "Politique de confidentialité"
      },
      {
        "kind": "paragraph",
        "text": "Barber Paradise s’engage à respecter les dispositions sur la protection des données, et notamment le règlement (UE) 2016 sur la protection des données relatif à la protection des personnes physiques à l’égard du traitement des données à caractère personnel et à la libre circulation de ces données ou « RGPD », ainsi que le loi informatique et libertés de 1978, modifiée par la loi du 20 juin 2018 relative à la protection des données personnelles dans le droit national français."
      },
      {
        "kind": "paragraph",
        "text": "La présente politique de confidentialité a pour objectif de vous informer de manière transparente sur les traitements de vos données personnelles réalisés par Barber Paradise et de préciser les conditions de traitement et d'utilisation de ces informations. Nous nous engageons à être transparents quant aux données que nous collectons, la manière dont elles sont utilisées et les droits dont vous disposez à l'égard de ces données."
      },
      {
        "kind": "paragraph",
        "text": "Dans toutes ses activités de traitement de données personnelles, Barber Paradise agit en tant que responsable de traitement au sens RGPD, determinant ainsi les finalités et les moyens des traitements réalisés."
      },
      {
        "kind": "paragraph",
        "text": "1/ Quelles données personnelles collectons-nous ?"
      },
      {
        "kind": "paragraph",
        "text": "Pour faciliter vos achats sur Barber Paradise, traiter vos commandes, et gérer vos interactions avec notre service, nous collectons divers types de données personnelles, notamment :"
      },
      {
        "kind": "list_item",
        "text": "Données d'identification : nom, prénom, adresse mail et postale, numéro de téléphone ;"
      },
      {
        "kind": "list_item",
        "text": "Données économiques et financières : détails de vos achats, informations de paiement et toute autre information liée à vos transactions ;"
      },
      {
        "kind": "list_item",
        "text": "Historique des commandes : produits achetés, dates d'achat, quantités, retours éventuels et toute communication liée au service après-vente ;"
      },
      {
        "kind": "list_item",
        "text": "Données de connexion : adresse IP, type de navigateur, suivi de votre navigation sur notre site, ainsi que les interactions avec les fonctionnalités du site."
      },
      {
        "kind": "paragraph",
        "text": "Nous nous engageons à utiliser ces informations uniquement dans le cadre prévu par notre politique de confidentialité et dans le respect de la législation en vigueur."
      },
      {
        "kind": "paragraph",
        "text": "2/ Pour quelles finalités les données sont-elles traitées ?"
      },
      {
        "kind": "paragraph",
        "text": "Dans le cadre de la gestion de nos services, l'entité peut être amené à collecter et traiter vos données personnelles pour les finalités suivantes :"
      },
      {
        "kind": "list_item",
        "text": "Traitement et gestion des commandes : Pour traiter les achats, gérer les transactions, les livraisons, les retours et les remboursements ;"
      },
      {
        "kind": "list_item",
        "text": "Service client : Pour répondre aux demandes de service après-vente, résoudre les problèmes et fournir un support personnalisé ;"
      },
      {
        "kind": "list_item",
        "text": "Amélioration des services : Pour analyser l'utilisation de notre site, améliorer l'expérience utilisateur, développer de nouveaux produits et optimiser nos services."
      },
      {
        "kind": "paragraph",
        "text": "3/ Sur quelles bases légales fondons nous les traitements ?"
      },
      {
        "kind": "paragraph",
        "text": "Le traitement de vos données personnelles par Barber Paradise repose sur plusieurs bases légales, conformément à la legislation en vigueur :"
      },
      {
        "kind": "list_item",
        "text": "Exécution d'un contrat : Nous traitons vos données personnelles pour l'exécution d'un contrat lorsque vous effectuez un achat sur notre site. Cela inclut la préparation de votre commande, la gestion des paiements, les livraisons, et le service après-vente ;"
      },
      {
        "kind": "list_item",
        "text": "Consentement : Pour certaines opérations de traitement, notamment la collecte de cookies non essentiels, nous sollictons votre consentement explicite ;"
      },
      {
        "kind": "list_item",
        "text": "Obligations légales : Nous traitons également vos données personnelles pour nous conformer à diverses obligations légales, telles que la conservation des données pour des raisons comptables ;"
      },
      {
        "kind": "list_item",
        "text": "Intérêts légitimes : Pour certains types de traitement, tel que la sécurité de notre site internet nous nous basons sur nos intérêts légitimes à réaliser ce traitement."
      },
      {
        "kind": "paragraph",
        "text": "4/ Quels sont les destinataires des données personnelles ?"
      },
      {
        "kind": "paragraph",
        "text": "Nous partageons vos données personnelles uniquement avec des tiers qui nous aident à fournir nos services, comme suit :"
      },
      {
        "kind": "list_item",
        "text": "Prestataires de services de paiement : pour traiter les paiements de vos achats. Ces partenaires ont un accès limité à vos données personnelles dans le cadre de l'exécution des paiements et ne sont pas autorisés à les utiliser pour d'autres finalités ;"
      },
      {
        "kind": "list_item",
        "text": "Fournisseurs de services logistiques : pour organiser la livraison de vos commandes. Ils reçoivent les informations nécessaires pour effectuer les livraisons ou gérer les retours ;"
      },
      {
        "kind": "list_item",
        "text": "Fournisseurs de services informatiques : qui nous aident à maintenir et à améliorer notre site web. Cela peut inclure des services d'hébergement, de maintenance, et de support technique."
      },
      {
        "kind": "paragraph",
        "text": "5/ Quelles mesures de sécurité mettons-nous en place ?"
      },
      {
        "kind": "paragraph",
        "text": "Barber Paradise s’engage à mettre en place des mesures techniques pour assurer la sécurité de vos données personnelles. Vos données personnelles sont hébergées sur les serveurs d'OVH, garantissant ainsi que nous utilisons des infrastructures respectant des normes de sécurité élevées."
      },
      {
        "kind": "paragraph",
        "text": "6/ Combien de temps conservons-nous vos données personnelles ?"
      },
      {
        "kind": "paragraph",
        "text": "Barber Paradise s'engage à ne conserver les données personnelles que pour la durée strictement nécessaire à la réalisation des objectifs pour lesquels elles ont été collectées. Concrètement, cela signifie que vos informations seront conservées pour la durée nécessaire à la gestion de notre relation commerciale. Après cette période, vos données seront conservées uniquement pour satisfaire aux exigences légales imposées par la législation française. La période de conservation de ces données ne dépassera pas une limite de 10 ans à compter de la fin de la relation commerciale, sauf si une période de rétention plus longue est requise ou justifiée par une loi ou une autre obligation réglementaire."
      },
      {
        "kind": "paragraph",
        "text": "7/ Quels sont vos droits en tant que personne concernée ?"
      },
      {
        "kind": "paragraph",
        "text": "En tant que personne physique, vous disposez de plusieurs droits concernant vos données personnelles, notamment :"
      },
      {
        "kind": "list_item",
        "text": "Droit d’accès : Vous pouvez demander à tout moment l’accès aux données vous concernant ainsi qu’une copie de ces données ;"
      },
      {
        "kind": "list_item",
        "text": "Droit de rectification : Vous pouvez demander la correction de données inexactes ou incomplètes à tout moment ;"
      },
      {
        "kind": "list_item",
        "text": "Droit à l’effacement : Vous pouvez demander la suppression de vos données personnelles lorsque, par exemple, elles ne sont plus nécessaires aux fins pour lesquelles elles ont été collectées ou traitées ;"
      },
      {
        "kind": "list_item",
        "text": "Droit à la restriction du traitement : Vous avez la possibilité de demander à limiter le traitement de vos données, par exemple si vous contestez l’exactitude des données vous concernant ou si vous vous opposez au traitement de vos données ;"
      },
      {
        "kind": "list_item",
        "text": "Droit à la portabilité : Vous pouvez demander le transfert de vos données à un autre responsable de traitement dans un format structuré, couramment utilisé et lisible par machine, lorsque le traitement est automatisé et basé sur votre consentement ;"
      },
      {
        "kind": "list_item",
        "text": "Droit d'opposition : Vous avez le droit de vous opposer au traitement de vos données et de retirer votre consentement à tout moment, si le traitement de vos données est basé sur le consentement."
      },
      {
        "kind": "paragraph",
        "text": "Pour exercer ces droits, veuillez contacter notre support à l'adresse suivante : contact@barberparadise.fr. Toute demande sera traitée dans un délai d’un mois, pouvant être étendu de deux mois supplémentaires si la demande est particulièrement complexe ou en cas de volume élevé de demandes. Nous vous informerons de toute extension de délai dans les meilleurs délais."
      },
      {
        "kind": "paragraph",
        "text": "Vos demandes seront traitées dans les limites prévues par la loi, notamment conformément aux articles 15 à 23 du RGPD. Si vous n'êtes pas satisfait de la manière dont nous traitons vos données ou de la réponse à vos demandes, vous avez également le droit de déposer une plainte auprès de la Commission nationale de l'informatique et des libertés (CNIL), ou toute autre autorité de contrôle compétente dans un État membre de l’UE."
      },
      {
        "kind": "paragraph",
        "text": "8/ Gestion des cookies"
      },
      {
        "kind": "paragraph",
        "text": "Notre site Barber Paradise utilise des cookies pour améliorer votre expérience utilisateur, analyser le trafic et afficher des publicités personnalisées. Les « cookies » sont de petits fichiers texte de taille limitée qui sont téléchargés sur votre appareil et nous permettent de reconnaître votre ordinateur, tablette ou mobile afin de personnaliser les services que nous offrons et d'améliorer votre expérience. Les cookies sont utilisés exclusivement pour nos propres besoins afin d'améliorer l'interactivité du site."
      },
      {
        "kind": "paragraph",
        "text": "Nous utilisons à la fois des cookies de session, qui expirent lorsque vous fermez votre navigateur, et des cookies persistants, qui restent sur votre appareil jusqu'à leur expiration ou leur suppression. Vous avez la possibilité de refuser les cookies commerciales ou marketing, basés sur votre consentement."
      },
      {
        "kind": "paragraph",
        "text": "9/ Modification de la présente politique"
      },
      {
        "kind": "paragraph",
        "text": "Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment pour refléter les changements dans nos pratiques de traitement des données ou les modifications des lois applicables. Nous publierons toutes les modifications sur notre site, et nous vous encourageons à consulter régulièrement cette page pour rester informé de toute mise à jour."
      },
      {
        "kind": "paragraph",
        "text": "10/ Contact"
      },
      {
        "kind": "paragraph",
        "text": "Si vous avez des questions ou des préoccupations concernant cette politique de confidentialité, ou si vous souhaitez exercer vos droits relatifs à vos données personnelles, veuillez nous contacter à l'adresse suivante : contact@barberparadise.fr . Vous pouvez également nous joindre par courrier postal à l'adresse suivante : 31 Rue de Pont-à-Mousson, 57950 Montigny-lès-Metz."
      }
    ]
  },
  "cookies": {
    "title": "Politique de cookies",
    "intro": "Informations relatives aux cookies, traceurs, bases légales et choix de consentement, extraites de la politique de confidentialité existante.",
    "sources": [
      "https://www.barberparadise.fr/policies/privacy-policy"
    ],
    "blocks": [
      {
        "kind": "heading1",
        "text": "Politique de cookies"
      },
      {
        "kind": "list_item",
        "text": "Consentement : Pour certaines opérations de traitement, notamment la collecte de cookies non essentiels, nous sollictons votre consentement explicite ;"
      },
      {
        "kind": "list_item",
        "text": "Obligations légales : Nous traitons également vos données personnelles pour nous conformer à diverses obligations légales, telles que la conservation des données pour des raisons comptables ;"
      },
      {
        "kind": "list_item",
        "text": "Intérêts légitimes : Pour certains types de traitement, tel que la sécurité de notre site internet nous nous basons sur nos intérêts légitimes à réaliser ce traitement."
      },
      {
        "kind": "paragraph",
        "text": "4/ Quels sont les destinataires des données personnelles ?"
      },
      {
        "kind": "paragraph",
        "text": "Nous partageons vos données personnelles uniquement avec des tiers qui nous aident à fournir nos services, comme suit :"
      },
      {
        "kind": "list_item",
        "text": "Prestataires de services de paiement : pour traiter les paiements de vos achats. Ces partenaires ont un accès limité à vos données personnelles dans le cadre de l'exécution des paiements et ne sont pas autorisés à les utiliser pour d'autres finalités ;"
      },
      {
        "kind": "list_item",
        "text": "Fournisseurs de services logistiques : pour organiser la livraison de vos commandes. Ils reçoivent les informations nécessaires pour effectuer les livraisons ou gérer les retours ;"
      },
      {
        "kind": "list_item",
        "text": "Fournisseurs de services informatiques : qui nous aident à maintenir et à améliorer notre site web. Cela peut inclure des services d'hébergement, de maintenance, et de support technique."
      },
      {
        "kind": "paragraph",
        "text": "5/ Quelles mesures de sécurité mettons-nous en place ?"
      },
      {
        "kind": "paragraph",
        "text": "Barber Paradise s’engage à mettre en place des mesures techniques pour assurer la sécurité de vos données personnelles. Vos données personnelles sont hébergées sur les serveurs d'OVH, garantissant ainsi que nous utilisons des infrastructures respectant des normes de sécurité élevées."
      },
      {
        "kind": "paragraph",
        "text": "6/ Combien de temps conservons-nous vos données personnelles ?"
      },
      {
        "kind": "paragraph",
        "text": "Barber Paradise s'engage à ne conserver les données personnelles que pour la durée strictement nécessaire à la réalisation des objectifs pour lesquels elles ont été collectées. Concrètement, cela signifie que vos informations seront conservées pour la durée nécessaire à la gestion de notre relation commerciale. Après cette période, vos données seront conservées uniquement pour satisfaire aux exigences légales imposées par la législation française. La période de conservation de ces données ne dépassera pas une limite de 10 ans à compter de la fin de la relation commerciale, sauf si une période de rétention plus longue est requise ou justifiée par une loi ou une autre obligation réglementaire."
      },
      {
        "kind": "paragraph",
        "text": "7/ Quels sont vos droits en tant que personne concernée ?"
      },
      {
        "kind": "paragraph",
        "text": "En tant que personne physique, vous disposez de plusieurs droits concernant vos données personnelles, notamment :"
      },
      {
        "kind": "list_item",
        "text": "Droit d’accès : Vous pouvez demander à tout moment l’accès aux données vous concernant ainsi qu’une copie de ces données ;"
      },
      {
        "kind": "list_item",
        "text": "Droit de rectification : Vous pouvez demander la correction de données inexactes ou incomplètes à tout moment ;"
      },
      {
        "kind": "list_item",
        "text": "Droit à l’effacement : Vous pouvez demander la suppression de vos données personnelles lorsque, par exemple, elles ne sont plus nécessaires aux fins pour lesquelles elles ont été collectées ou traitées ;"
      },
      {
        "kind": "list_item",
        "text": "Droit à la restriction du traitement : Vous avez la possibilité de demander à limiter le traitement de vos données, par exemple si vous contestez l’exactitude des données vous concernant ou si vous vous opposez au traitement de vos données ;"
      },
      {
        "kind": "list_item",
        "text": "Droit à la portabilité : Vous pouvez demander le transfert de vos données à un autre responsable de traitement dans un format structuré, couramment utilisé et lisible par machine, lorsque le traitement est automatisé et basé sur votre consentement ;"
      },
      {
        "kind": "list_item",
        "text": "Droit d'opposition : Vous avez le droit de vous opposer au traitement de vos données et de retirer votre consentement à tout moment, si le traitement de vos données est basé sur le consentement."
      },
      {
        "kind": "paragraph",
        "text": "Pour exercer ces droits, veuillez contacter notre support à l'adresse suivante : contact@barberparadise.fr. Toute demande sera traitée dans un délai d’un mois, pouvant être étendu de deux mois supplémentaires si la demande est particulièrement complexe ou en cas de volume élevé de demandes. Nous vous informerons de toute extension de délai dans les meilleurs délais."
      },
      {
        "kind": "paragraph",
        "text": "Vos demandes seront traitées dans les limites prévues par la loi, notamment conformément aux articles 15 à 23 du RGPD. Si vous n'êtes pas satisfait de la manière dont nous traitons vos données ou de la réponse à vos demandes, vous avez également le droit de déposer une plainte auprès de la Commission nationale de l'informatique et des libertés (CNIL), ou toute autre autorité de contrôle compétente dans un État membre de l’UE."
      },
      {
        "kind": "paragraph",
        "text": "8/ Gestion des cookies"
      },
      {
        "kind": "paragraph",
        "text": "Notre site Barber Paradise utilise des cookies pour améliorer votre expérience utilisateur, analyser le trafic et afficher des publicités personnalisées. Les « cookies » sont de petits fichiers texte de taille limitée qui sont téléchargés sur votre appareil et nous permettent de reconnaître votre ordinateur, tablette ou mobile afin de personnaliser les services que nous offrons et d'améliorer votre expérience. Les cookies sont utilisés exclusivement pour nos propres besoins afin d'améliorer l'interactivité du site."
      },
      {
        "kind": "paragraph",
        "text": "Nous utilisons à la fois des cookies de session, qui expirent lorsque vous fermez votre navigateur, et des cookies persistants, qui restent sur votre appareil jusqu'à leur expiration ou leur suppression. Vous avez la possibilité de refuser les cookies commerciales ou marketing, basés sur votre consentement."
      },
      {
        "kind": "paragraph",
        "text": "9/ Modification de la présente politique"
      },
      {
        "kind": "paragraph",
        "text": "Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment pour refléter les changements dans nos pratiques de traitement des données ou les modifications des lois applicables. Nous publierons toutes les modifications sur notre site, et nous vous encourageons à consulter régulièrement cette page pour rester informé de toute mise à jour."
      },
      {
        "kind": "paragraph",
        "text": "10/ Contact"
      },
      {
        "kind": "paragraph",
        "text": "Si vous avez des questions ou des préoccupations concernant cette politique de confidentialité, ou si vous souhaitez exercer vos droits relatifs à vos données personnelles, veuillez nous contacter à l'adresse suivante : contact@barberparadise.fr . Vous pouvez également nous joindre par courrier postal à l'adresse suivante : 31 Rue de Pont-à-Mousson, 57950 Montigny-lès-Metz."
      }
    ]
  }
} satisfies Record<string, LegalPageContent>;
