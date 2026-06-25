/**
 * Script de test Mondial Relay — WSI3_PointRelais_Recherche
 * Usage : node test_mondial_relay.mjs [CP] [PAYS]
 * Exemple : node test_mondial_relay.mjs 57000 FR
 *
 * Nécessite les variables d'env :
 *   MONDIAL_RELAY_ENSEIGNE
 *   MONDIAL_RELAY_PRIVATE_KEY
 */

import crypto from "crypto";

const enseigne = (process.env.MONDIAL_RELAY_ENSEIGNE || "").trim();
const privateKey = (process.env.MONDIAL_RELAY_PRIVATE_KEY || "").trim();
const cp = process.argv[2] || "57000";
const country = (process.argv[3] || "FR").toUpperCase();

if (!enseigne || !privateKey) {
  console.error("❌ Variables d'env MONDIAL_RELAY_ENSEIGNE et MONDIAL_RELAY_PRIVATE_KEY requises");
  process.exit(1);
}

function xmlEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getXmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return match?.[1]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() || null;
}

function getXmlArrayOfString(xml, tag) {
  const blockMatch = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  if (!blockMatch) return [];
  const block = blockMatch[1];
  const regex = /<(?:\w+:)?string[^>]*>([\s\S]*?)<\/(?:\w+:)?string>/gi;
  const results = [];
  let match;
  while ((match = regex.exec(block)) !== null) {
    const val = match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    if (val) results.push(val);
  }
  return results;
}

// Signature MD5 : Enseigne + Pays + NumPointRelais + Ville + CP + Lat + Lon + Taille + Poids + Action + DelaiEnvoi + RayonRecherche + TypeActivite + NACE + PrivateKey
const securityValues = [enseigne, country, "", "", cp, "", "", "", "", "", "", "", "", ""];
const securityStr = securityValues.join("") + privateKey;
const security = crypto.createHash("md5").update(securityStr).digest("hex").toUpperCase();

console.log(`\n🔍 Recherche de points relais Mondial Relay`);
console.log(`   Enseigne : ${enseigne}`);
console.log(`   CP       : ${cp}`);
console.log(`   Pays     : ${country}`);
console.log(`   Security : ${security}`);
console.log(`   String   : "${securityStr.replace(privateKey, "****")}"\n`);

const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI3_PointRelais_Recherche xmlns="http://www.mondialrelay.fr/webservice/">
      <Enseigne>${xmlEscape(enseigne)}</Enseigne>
      <Pays>${xmlEscape(country)}</Pays>
      <NumPointRelais></NumPointRelais>
      <Ville></Ville>
      <CP>${xmlEscape(cp)}</CP>
      <Latitude></Latitude>
      <Longitude></Longitude>
      <Taille></Taille>
      <Poids></Poids>
      <Action></Action>
      <DelaiEnvoi></DelaiEnvoi>
      <RayonRecherche></RayonRecherche>
      <TypeActivite></TypeActivite>
      <NACE></NACE>
      <Security>${security}</Security>
    </WSI3_PointRelais_Recherche>
  </soap:Body>
</soap:Envelope>`;

try {
  const response = await fetch("https://api.mondialrelay.com/Web_Services.asmx", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: '"http://www.mondialrelay.fr/webservice/WSI3_PointRelais_Recherche"',
    },
    body: envelope,
  });

  const xml = await response.text();
  console.log(`HTTP Status : ${response.status}`);

  if (!response.ok) {
    console.error("❌ Erreur HTTP :", xml.slice(0, 500));
    process.exit(1);
  }

  const stat = getXmlValue(xml, "STAT");
  console.log(`STAT Mondial Relay : ${stat}`);

  if (stat && stat !== "0") {
    console.error(`❌ Erreur STAT ${stat}`);
    console.error("Réponse XML :", xml.slice(0, 800));
    process.exit(1);
  }

  const pointsXml = xml.match(/<PointRelais_Details[\s\S]*?<\/PointRelais_Details>/gi) || [];
  console.log(`\n✅ ${pointsXml.length} point(s) relais trouvé(s) pour le CP ${cp}\n`);

  pointsXml.slice(0, 5).forEach((block, i) => {
    const id = getXmlValue(block, "Num") || "";
    const name = getXmlValue(block, "LgAdr1") || "";
    const address = getXmlValue(block, "LgAdr3") || "";
    const city = getXmlValue(block, "Ville") || "";
    const postalCode = getXmlValue(block, "CP") || "";
    const distance = getXmlValue(block, "Distance") || "";
    const lundi = getXmlArrayOfString(block, "Horaires_Lundi");

    console.log(`  [${i + 1}] ID: ${id}`);
    console.log(`       Nom    : ${name}`);
    console.log(`       Adresse: ${address}, ${postalCode} ${city}`);
    console.log(`       Distance: ${distance}m`);
    console.log(`       Lundi  : ${lundi.join(", ") || "Fermé"}`);
    console.log();
  });

} catch (err) {
  console.error("❌ Erreur réseau :", err.message);
  process.exit(1);
}
