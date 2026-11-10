import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { mondialRelayRouter } from "./mondialrelay";

// Exercise the real Express route/parser with only fetch replaced. No HTTP
// listener, carrier call, production configuration or label creation is used.
const route = (mondialRelayRouter as any).stack.find((layer: any) => layer.route?.path === "/points");
const handler = route.route.stack[0].handle as (req: Request, res: Response) => Promise<void>;

function fixture(name: string, address: string, city: string): string {
  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
    <WSI3_PointRelais_RechercheResponse><WSI3_PointRelais_RechercheResult><STAT>0</STAT><PointsRelais>
      <PointRelais_Details><Num>020965</Num><LgAdr1>${name}</LgAdr1><LgAdr3>${address}</LgAdr3>
        <Ville>${city}</Ville><CP>30500</CP><Pays>FR</Pays><Latitude>44,25</Latitude><Longitude>4,20</Longitude><Distance>1250</Distance>
        <Horaires_Lundi><string>0900-1200</string><string>1400-1900</string></Horaires_Lundi>
      </PointRelais_Details>
    </PointsRelais></WSI3_PointRelais_RechercheResult></WSI3_PointRelais_RechercheResponse>
  </soap:Body></soap:Envelope>`;
}

async function main() {
  const originalFetch = globalThis.fetch;
  const oldEnseigne = process.env.MONDIAL_RELAY_ENSEIGNE;
  const oldKey = process.env.MONDIAL_RELAY_PRIVATE_KEY;
  const oldError = console.error;
  let calls = 0;
  let xml = "";
  let ok = true;
  process.env.MONDIAL_RELAY_ENSEIGNE = "TEST_ONLY";
  process.env.MONDIAL_RELAY_PRIVATE_KEY = "NOT_A_REAL_KEY";
  globalThis.fetch = (async (url: unknown, init: any) => {
    calls++;
    assert.equal(url, "https://api.mondialrelay.com/Web_Services.asmx");
    assert.equal(init.method, "POST");
    assert.match(init.body, /<WSI3_PointRelais_Recherche /);
    return { ok, status: ok ? 200 : 502, text: async () => xml };
  }) as typeof fetch;
  try {
    for (const [name, address, city, expectedName, expectedAddress, expectedCity] of [
      ["LOCKER D''ALÈS", "98 ROUTE D''ALES", "SAINT AMBROIX", "LOCKER D'ALÈS", "98 ROUTE D'ALES", "SAINT AMBROIX"],
      ["L&apos;&apos;Épicerie &amp; &quot;Relais&quot;", "D&apos;&apos;ITALIE", "D&apos;&apos;ALÈS", "L'Épicerie & \"Relais\"", "D'ITALIE", "D'ALÈS"],
      ["L&#39;&#39;Épicerie", "D&#39;&#39;&#39;ALES", "Al&#233;s", "L'Épicerie", "D'ALES", "Alés"],
      ["L&#x27;&#x27;Atelier", "D&#x27;&#x27;UZ&#xC8;S", "Al&#xE8;s", "L'Atelier", "D'UZÈS", "Alès"],
      ["L'Atelier d'Alès", "Allée de l’École", "D’’ALÈS", "L'Atelier d'Alès", "Allée de l’École", "D’’ALÈS"],
      ["", "", "", "", "", ""],
    ]) {
      xml = fixture(name, address, city);
      let payload: any;
      let status = 200;
      const res = { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; return this; } } as unknown as Response;
      await handler({ query: { cp: "30500", country: "FR" } } as unknown as Request, res);
      assert.equal(status, 200);
      assert.equal(payload.count, 1);
      const point = payload.points[0];
      assert.equal(point.id, "020965", "leading zero must survive");
      assert.equal(point.name, expectedName);
      assert.equal(point.address, expectedAddress);
      assert.equal(point.city, expectedCity);
      assert.equal(point.fullAddress, [expectedAddress, "30500", expectedCity].filter(Boolean).join(", "));
      assert.equal(point.postalCode, "30500");
      assert.equal(point.country, "FR");
      assert.equal(point.latitude, 44.25);
      assert.equal(point.longitude, 4.20);
      assert.equal(point.distance, 1250);
      assert.equal(point.openingHours.monday, "09:00 – 12:00 / 14:00 – 19:00");
      assert.equal(point.openingHours.sunday, "Fermé");
    }
    console.error = () => undefined;
    for (const [nextXml, nextOk, expectedStatus] of [["<STAT>97</STAT>", true, 502], ["SOAP unavailable", false, 502]] as const) {
      xml = nextXml;
      ok = nextOk;
      let status = 200;
      const res = { status(code: number) { status = code; return this; }, json() { return this; } } as unknown as Response;
      await handler({ query: { cp: "30500" } } as unknown as Request, res);
      assert.equal(status, expectedStatus, "existing SOAP error handling unchanged");
    }
    assert.equal(calls, 8);
    console.log("✓ Mondial Relay SOAP route passed: 6 fixtures + 2 error cases, fetch mocked, id 020965 intact");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = oldError;
    if (oldEnseigne === undefined) delete process.env.MONDIAL_RELAY_ENSEIGNE;
    else process.env.MONDIAL_RELAY_ENSEIGNE = oldEnseigne;
    if (oldKey === undefined) delete process.env.MONDIAL_RELAY_PRIVATE_KEY;
    else process.env.MONDIAL_RELAY_PRIVATE_KEY = oldKey;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
