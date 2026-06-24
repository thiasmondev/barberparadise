import { Router, Request, Response } from "express";
import crypto from "crypto";

const mondialRelayRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────

function getEnseigne() {
  return (process.env.MONDIAL_RELAY_ENSEIGNE || "").trim();
}

function getPrivateKey() {
  return (process.env.MONDIAL_RELAY_PRIVATE_KEY || "").trim();
}

function xmlEscape(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getXmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return match?.[1]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() || null;
}

function getXmlValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "gi");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim());
  }
  return results;
}

function mondialRelaySecurity(values: Array<string | number | null | undefined>) {
  const privateKey = getPrivateKey();
  return crypto
    .createHash("md5")
    .update(values.map((v) => String(v ?? "")).join("") + privateKey)
    .digest("hex")
    .toUpperCase();
}

interface RelayPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  openingHours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  fullAddress: string;
}

function parseOpeningHours(xml: string, prefix: string): RelayPoint["openingHours"] {
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const keys: (keyof RelayPoint["openingHours"])[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const result: RelayPoint["openingHours"] = {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  };
  days.forEach((day, i) => {
    const am = getXmlValue(xml, `${prefix}${day}Matin`) || "";
    const pm = getXmlValue(xml, `${prefix}${day}ApresMidi`) || "";
    const parts: string[] = [];
    if (am && am !== "0000-0000") parts.push(am.replace("-", " – "));
    if (pm && pm !== "0000-0000") parts.push(pm.replace("-", " – "));
    result[keys[i]] = parts.join(" / ") || "Fermé";
  });
  return result;
}

// ─── Route GET /api/mondialrelay/points ──────────────────────
// Query params: cp (code postal), country (FR par défaut), nb (nombre de résultats, défaut 10)
mondialRelayRouter.get("/points", async (req: Request, res: Response): Promise<void> => {
  const cp = String(req.query.cp || "").trim().replace(/\s/g, "");
  const country = String(req.query.country || "FR").trim().toUpperCase();
  const nb = Math.min(parseInt(String(req.query.nb || "10"), 10) || 10, 20);

  if (!cp || cp.length < 4) {
    res.status(400).json({ error: "Code postal requis (minimum 4 caractères)" });
    return;
  }

  const enseigne = getEnseigne();
  const privateKey = getPrivateKey();

  if (!enseigne || !privateKey) {
    res.status(503).json({ error: "Configuration Mondial Relay manquante" });
    return;
  }

  try {
    // WSI3_PointRelaisRecherche — recherche de points relais par code postal
    const securityValues = [enseigne, "24R", country, cp, "", "", "", "", "", "", "", nb.toString(), "", "", "", "", "1", ""];
    const security = mondialRelaySecurity(securityValues);

    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI3_PointRelaisRecherche xmlns="http://www.mondialrelay.fr/webservice/">
      <Enseigne>${xmlEscape(enseigne)}</Enseigne>
      <ModeLiv>24R</ModeLiv>
      <Pays>${xmlEscape(country)}</Pays>
      <CP>${xmlEscape(cp)}</CP>
      <Ville></Ville>
      <Latitude></Latitude>
      <Longitude></Longitude>
      <Taille></Taille>
      <Poids></Poids>
      <Action></Action>
      <DelaiEnvoi></DelaiEnvoi>
      <RayonRecherche></RayonRecherche>
      <TypeActivite></TypeActivite>
      <NACE></NACE>
      <NombreResultats>${nb}</NombreResultats>
      <Langue>FR</Langue>
      <Offset></Offset>
      <Security>${security}</Security>
    </WSI3_PointRelaisRecherche>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch("https://api.mondialrelay.com/Web_Services.asmx", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://www.mondialrelay.fr/webservice/WSI3_PointRelaisRecherche",
      },
      body: envelope,
      signal: AbortSignal.timeout(10000),
    });

    const xml = await response.text();

    if (!response.ok) {
      console.error("[mondialrelay] Erreur HTTP", response.status, xml.slice(0, 400));
      res.status(502).json({ error: "Erreur API Mondial Relay" });
      return;
    }

    const stat = getXmlValue(xml, "STAT");
    if (stat && stat !== "0") {
      console.error("[mondialrelay] STAT d'erreur:", stat, xml.slice(0, 600));
      res.status(502).json({ error: `Mondial Relay a retourné une erreur (STAT ${stat})` });
      return;
    }

    // Parser les points relais depuis le XML
    // Chaque point relais est dans un bloc <PointRelais_Details>
    const pointsXml = xml.match(/<PointRelais_Details[\s\S]*?<\/PointRelais_Details>/gi) || [];

    const points: RelayPoint[] = pointsXml.map((block) => {
      const id = getXmlValue(block, "Num") || "";
      const name = getXmlValue(block, "LgAdr1") || "";
      const address = getXmlValue(block, "LgAdr3") || "";
      const city = getXmlValue(block, "Ville") || "";
      const postalCode = getXmlValue(block, "CP") || "";
      const countryCode = getXmlValue(block, "Pays") || country;
      const latStr = getXmlValue(block, "Latitude") || "";
      const lngStr = getXmlValue(block, "Longitude") || "";
      const distStr = getXmlValue(block, "Distance") || "";

      const latitude = latStr ? parseFloat(latStr.replace(",", ".")) : null;
      const longitude = lngStr ? parseFloat(lngStr.replace(",", ".")) : null;
      const distance = distStr ? parseInt(distStr, 10) : null;

      const openingHours = parseOpeningHours(block, "Horaires_");
      const fullAddress = [address, postalCode, city].filter(Boolean).join(", ");

      return {
        id,
        name,
        address,
        city,
        postalCode,
        country: countryCode,
        latitude,
        longitude,
        distance,
        openingHours,
        fullAddress,
      };
    });

    res.json({ points, count: points.length });
  } catch (err: any) {
    console.error("[mondialrelay] Erreur recherche points relais:", err.message);
    res.status(500).json({ error: "Impossible de récupérer les points relais" });
  }
});

export { mondialRelayRouter };
