import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildMondialRelayCreationRequest, MONDIAL_RELAY_CREATION_FIELDS, normalizeMondialRelayParameter } from "./mondialRelayRequest";
import { buildShipmentQuotes, CarrierLabelCreationError, createOfficialShipmentLabel } from "../services/logisticsCarrierService";

// All credentials, contacts and PDF contents below are synthetic. No network calls.
const fakeKey = "LOCAL_TEST_KEY";
function decodeXml(text: string) {
  return text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function field(xml: string, key: string) { return decodeXml(xml.match(new RegExp(`<${key}>([\\s\\S]*?)</${key}>`))?.[1] || ""); }
function assertSignatureMatches(xml: string) {
  const values = MONDIAL_RELAY_CREATION_FIELDS.map((key) => field(xml, key));
  const expected = crypto.createHash("md5").update(values.join("") + fakeKey, "utf8").digest("hex").toUpperCase();
  assert.equal(field(xml, "Security"), expected, "MD5 recomputed from the actual decoded XML must match, including all optional fields");
}
async function run() {
  for (const apostrophe of ["'", "’", "‘", "`", "´", "ʼ"]) {
    assert.equal(normalizeMondialRelayParameter("Dest_Ad3", `1 rue de l${apostrophe}église`), "1 RUE DE L'EGLISE");
  }
  for (const dash of ["-", "–", "—", "‑", "−"]) {
    assert.equal(normalizeMondialRelayParameter("Dest_Ville", `Saint${dash}Ambroix`), "SAINT-AMBROIX");
  }
  for (const space of [" ", "\u00a0", "\u202f", "\u2007"]) {
    assert.equal(normalizeMondialRelayParameter("Dest_Ad3", `1${space}rue${space}de${space}l’église`), "1 RUE DE L'EGLISE");
  }
  for (const [left, right] of [["«", "»"], ["“", "”"], ["\"", "\""]]) {
    assert.equal(normalizeMondialRelayParameter("Dest_Ad3", `1 rue ${left}de l’église${right}`), "1 RUE DE L'EGLISE");
  }
  assert.equal(normalizeMondialRelayParameter("Dest_Ad3", "98 ROUTE D''ALÈS"), "98 ROUTE D'ALES");
  assert.equal(normalizeMondialRelayParameter("Dest_Ad3", "Rue D''''Italie"), "RUE D'ITALIE");
  assert.equal(normalizeMondialRelayParameter("Dest_Ad4", "3"), "3");
  assert.equal(normalizeMondialRelayParameter("Dest_Ad3", "a".repeat(40)).length, 32);
  assert.equal(normalizeMondialRelayParameter("Dest_Ville", "a".repeat(40)).length, 26);
  assert.equal(normalizeMondialRelayParameter("Dest_Ville", "Saint. Ambroix @ 123"), "SAINT AMBROIX");
  assert.equal(normalizeMondialRelayParameter("Dest_Tel1", "+33 6 00 00 00 00"), "0600000000");
  assert.equal(normalizeMondialRelayParameter("Dest_Mail", " Client+Test@Example.test "), "Client+Test@Example.test", "Do not uppercase or rewrite emails");
  const oneCharacter = buildMondialRelayCreationRequest({ Dest_Ad3: "1 rue de l’église", Dest_Ad4: "3", Expe_Ad4: "B", Dest_Ville: "Saint-Ambroix" }, fakeKey);
  assertSignatureMatches(oneCharacter.envelope);
  assert.equal(field(oneCharacter.envelope, "Dest_Ad4"), "3");
  assert.equal(field(oneCharacter.envelope, "Expe_Ad4"), "B");
  assert.ok(Object.isFrozen(oneCharacter.parameters));
  const empty = buildMondialRelayCreationRequest({ Dest_Ad4: "", Expe_Ad4: null }, fakeKey);
  assertSignatureMatches(empty.envelope);
  assert.ok(!empty.envelope.includes("<Dest_Ad4>"));
  console.log("✓ Normalisation MR : typographie, accents, apostrophes, tirets, espaces, règles de ville et longueurs ; compléments 1 caractère présents dans MD5 ET SOAP");

  const oldFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  process.env.MONDIAL_RELAY_ENSEIGNE = "BDTEST13";
  process.env.MONDIAL_RELAY_PRIVATE_KEY = fakeKey;
  process.env.MONDIAL_RELAY_MODE_COL = "CCC";
  process.env.MONDIAL_RELAY_MODE_LIV = "24R";
  let reject = false;
  let failNetwork = false;
  let soapCalls = 0;
  let pdfCalls = 0;
  let actualParameters: Record<string, string> = {};
  globalThis.fetch = (async (url: unknown, init?: any) => {
    if (init?.body) {
      soapCalls++;
      const xml = String(init.body);
      assert.equal(init.headers["Content-Type"], "text/xml; charset=utf-8");
      assertSignatureMatches(xml);
      actualParameters = Object.fromEntries(MONDIAL_RELAY_CREATION_FIELDS.map((key) => [key, field(xml, key)]));
      if (failNetwork) throw new Error("Réseau simulé indisponible");
      return new Response(reject
        ? "<WSI2_CreationExpeditionResult><STAT>97</STAT></WSI2_CreationExpeditionResult>"
        : "<WSI2_CreationExpeditionResult><STAT>0</STAT><ExpeditionNum>99999999</ExpeditionNum><URL_Etiquette>/test-label?format=A4</URL_Etiquette></WSI2_CreationExpeditionResult>", { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });
    }
    pdfCalls++;
    assert.ok(String(url).includes("format=10x15"));
    return new Response("%PDF-1.4\nLOCAL SYNTHETIC TEST ONLY\n%%EOF", { status: 200, headers: { "content-type": "application/pdf" } });
  }) as typeof fetch;
  try {
    for (const extension of ["", "3", "B", "Bâtiment 3", "Étage — 3"]) {
      const input = {
        orderNumber: "BP-TEST-STAT97", customerEmail: "client@example.test",
        recipient: { firstName: "Client", lastName: "Test", address: "1 rue de l’église", extension, city: "Saint-Ambroix", postalCode: "30500", country: "FR", phone: "0600000000" },
        sender: { companyName: "Équipe Test", firstName: "Equipe", lastName: "Test", address: "1 allée D''Italie", extension: "B", city: "Metz", postalCode: "57000", country: "FR", phone: "0600000001", email: "contact@example.test" },
        totalWeightG: 2420, orderValueCents: 10000,
      };
      const before = structuredClone(input);
      const quote = buildShipmentQuotes(input).find((entry) => entry.carrier === "mondial_relay")!;
      const result = await createOfficialShipmentLabel({ ...input, carrier: "mondial_relay", offerId: quote.id, insuranceValueCents: 0, relayPointId: "020965" });
      assert.equal(result.labelStatus, "carrier_label_created");
      assert.ok(Buffer.from(result.labelPdfBase64!, "base64").toString().startsWith("%PDF"));
      assert.equal(actualParameters.Dest_Ad3, "1 RUE DE L'EGLISE");
      assert.equal(actualParameters.Dest_Ad4, normalizeMondialRelayParameter("Dest_Ad4", extension));
      assert.equal(actualParameters.Poids, "2420");
      assert.equal(actualParameters.LIV_Rel, "020965");
      assert.deepEqual(result.rawResponse?.normalizedRequestParameters, actualParameters);
      assert.deepEqual(input, before, "Saved client data and original typography must not be changed");
    }
    const input = { orderNumber: "BP-TEST-FAIL", customerEmail: "client@example.test", recipient: { firstName: "Client", lastName: "Test", address: "1 rue de l’église", extension: "3", city: "Saint-Ambroix", postalCode: "30500", country: "FR" }, sender: { companyName: "Test", firstName: "Equipe", lastName: "Test", address: "1 rue Test", city: "Metz", postalCode: "57000", country: "FR" }, totalWeightG: 2420, orderValueCents: 10000 };
    const quote = buildShipmentQuotes(input).find((entry) => entry.carrier === "mondial_relay")!;
    reject = true;
    for (const networkError of [false, true]) {
      failNetwork = networkError;
      await assert.rejects(() => createOfficialShipmentLabel({ ...input, carrier: "mondial_relay", offerId: quote.id, insuranceValueCents: 0, relayPointId: "020965" }), (error: any) => {
        assert.ok(error instanceof CarrierLabelCreationError);
        assert.deepEqual(error.rawResponse.normalizedRequestParameters, actualParameters);
        const serialized = JSON.stringify(error.rawResponse);
        assert.ok(!serialized.includes(fakeKey));
        assert.ok(!serialized.includes("Security"));
        assert.ok(!serialized.includes("<soap:Envelope"));
        if (!networkError) assert.equal(error.rawResponse.status, "97");
        return true;
      });
    }
    assert.equal(soapCalls, 7);
    assert.equal(pdfCalls, 5);
    console.log("✓ Service MR complet simulé : MD5 recomputé sur chaque requête réelle, 5 réponses STAT0/PDF fictifs, diagnostics STAT97/réseau enrichis SANS clé ni Security ; aucune connexion réseau");
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    for (const [key, value] of Object.entries(savedEnv)) if (value !== undefined) process.env[key] = value;
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
