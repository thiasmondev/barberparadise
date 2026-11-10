-- LOCAL SYNTHETIC TEST ONLY. Run with psql -X -v ON_ERROR_STOP=1 -f this-file.sql
-- Creates only session-local temporary tables. pg_temp-only search_path ensures
-- that migration/audit cannot resolve application tables in public or elsewhere.
\set ON_ERROR_STOP on
SET search_path TO pg_temp;

CREATE TEMP TABLE "Order" (id text PRIMARY KEY, "relayPointId" text, "relayPointName" text, "relayPointAddress" text, "billingAddress" jsonb);
CREATE TEMP TABLE "OrderExchange" (id text PRIMARY KEY, "relayPointSnapshot" jsonb, "shippingAddressSnapshot" jsonb);
CREATE TEMP TABLE "OrderExchangeShipment" (id text PRIMARY KEY, "relayPointSnapshot" jsonb);
CREATE TEMP TABLE "ShippingAddress" (address text, extension text, city text);
CREATE TEMP TABLE "Address" (address text, extension text, city text);
CREATE TEMP TABLE "Customer" ("firstName" text, "lastName" text);

INSERT INTO "ShippingAddress" VALUES ($text$Allée de l’École D''ALÈS$text$, 'Bâtiment É', 'Uzès');
INSERT INTO "Address" SELECT * FROM "ShippingAddress";
INSERT INTO "Customer" VALUES ('Élodie', $text$D''Alès$text$);
INSERT INTO "Order" VALUES
 ('synthetic-1', '020965', $text$L''Épicerie$text$, $text$98 ROUTE D''''ALES$text$, jsonb_build_object('address', $text$Allée D''ALÈS$text$)),
 ('synthetic-null', NULL, NULL, NULL, NULL),
 ('synthetic-clean', '000001', $text$L'Atelier d'Alès$text$, 'Allée de l’École D’’ALÈS', '{}'::jsonb);
INSERT INTO "OrderExchange" VALUES
 ('synthetic-1', jsonb_build_object('id', '020965', 'name', $text$L''Épicerie$text$, 'address', $text$98 ROUTE D''''ALES$text$,
   'city', $text$D''Alès$text$, 'fullAddress', $text$98 ROUTE D''ALES, D''Alès$text$, 'relayPointName', $text$L''Épicerie$text$,
   'relayPointAddress', $text$D'''ITALIE$text$, 'postalCode', '30500', 'country', 'FR', 'extra', $text$KEEP''THIS$text$,
   'nested', jsonb_build_object('address', $text$CUSTOMER''VALUE$text$), 'nullable', NULL),
   jsonb_build_object('firstName', 'Élodie', 'lastName', $text$D''Alès$text$, 'address', $text$Allée D''ALÈS$text$, 'city', 'Uzès')),
 ('synthetic-null', NULL, NULL),
 ('synthetic-json-null', 'null'::jsonb, NULL),
 ('synthetic-array', '["D\u0027\u0027ALES"]'::jsonb, NULL),
 ('synthetic-scalar', to_jsonb($text$D''ALES$text$::text), NULL),
 ('synthetic-empty', '{}'::jsonb, NULL),
 ('synthetic-types', '{"name":42,"address":null,"city":["unchanged"],"id":"020965"}'::jsonb, NULL);
INSERT INTO "OrderExchangeShipment" SELECT id, "relayPointSnapshot" FROM "OrderExchange";

CREATE TEMP TABLE order_before AS SELECT id, to_jsonb(o) AS row_data FROM "Order" AS o;
CREATE TEMP TABLE exchange_before AS SELECT id, to_jsonb(e) AS row_data FROM "OrderExchange" AS e;
CREATE TEMP TABLE shipment_before AS SELECT id, to_jsonb(s) AS row_data FROM "OrderExchangeShipment" AS s;
CREATE TEMP TABLE client_before AS
 SELECT 'shipping'::text AS scope, to_jsonb(s) AS row_data FROM "ShippingAddress" AS s
 UNION ALL SELECT 'address', to_jsonb(a) FROM "Address" AS a
 UNION ALL SELECT 'customer', to_jsonb(c) FROM "Customer" AS c;

-- Aggregate-only audit before migration, then execute the exact migration.
\ir audit-mondial-relay-apostrophes.sql
\ir ../prisma/migrations/20261110210000_normalize_mondial_relay_display_apostrophes/migration.sql

DO $test$
DECLARE
 expected jsonb;
BEGIN
 IF EXISTS (SELECT 1 FROM "Order" o JOIN order_before b USING (id)
   WHERE to_jsonb(o) - ARRAY['relayPointName', 'relayPointAddress'] IS DISTINCT FROM b.row_data - ARRAY['relayPointName', 'relayPointAddress'])
 THEN RAISE EXCEPTION 'Order non-relay fields changed'; END IF;
 IF (SELECT "relayPointName" FROM "Order" WHERE id = 'synthetic-1') <> $text$L'Épicerie$text$
 OR (SELECT "relayPointAddress" FROM "Order" WHERE id = 'synthetic-1') <> $text$98 ROUTE D'ALES$text$
 THEN RAISE EXCEPTION 'Order relay cleanup failed'; END IF;
 IF EXISTS (SELECT 1 FROM "OrderExchange" e JOIN exchange_before b USING (id)
   WHERE to_jsonb(e) - 'relayPointSnapshot' IS DISTINCT FROM b.row_data - 'relayPointSnapshot')
 THEN RAISE EXCEPTION 'Client shippingAddressSnapshot changed'; END IF;
 IF EXISTS (SELECT 1 FROM "OrderExchange" e JOIN exchange_before b USING (id)
   WHERE e.id <> 'synthetic-1' AND to_jsonb(e) IS DISTINCT FROM b.row_data)
 THEN RAISE EXCEPTION 'Non-object/empty/non-string snapshot changed'; END IF;
 SELECT row_data -> 'relayPointSnapshot' INTO expected FROM exchange_before WHERE id = 'synthetic-1';
 expected := expected || jsonb_build_object('name', $text$L'Épicerie$text$, 'address', $text$98 ROUTE D'ALES$text$,
   'city', $text$D'Alès$text$, 'fullAddress', $text$98 ROUTE D'ALES, D'Alès$text$,
   'relayPointName', $text$L'Épicerie$text$, 'relayPointAddress', $text$D'ITALIE$text$);
 IF (SELECT "relayPointSnapshot" FROM "OrderExchange" WHERE id = 'synthetic-1') IS DISTINCT FROM expected
 OR (SELECT "relayPointSnapshot" FROM "OrderExchangeShipment" WHERE id = 'synthetic-1') IS DISTINCT FROM expected
 THEN RAISE EXCEPTION 'Snapshot cleanup/preservation failed'; END IF;
 IF EXISTS (SELECT 1 FROM "OrderExchangeShipment" s JOIN shipment_before b USING (id)
   WHERE s.id <> 'synthetic-1' AND to_jsonb(s) IS DISTINCT FROM b.row_data)
 THEN RAISE EXCEPTION 'Non-target shipment snapshot changed'; END IF;
 IF EXISTS (
   (SELECT scope, row_data FROM client_before EXCEPT
    SELECT 'shipping', to_jsonb(s) FROM "ShippingAddress" s EXCEPT
    SELECT 'address', to_jsonb(a) FROM "Address" a EXCEPT
    SELECT 'customer', to_jsonb(c) FROM "Customer" c)
 ) THEN RAISE EXCEPTION 'Client data changed'; END IF;
END;
$test$;

CREATE TEMP TABLE relay_after_first AS
 SELECT 'order'::text AS scope, id, xmin::text AS version, to_jsonb(o) AS row_data FROM "Order" o
 UNION ALL SELECT 'exchange', id, xmin::text, to_jsonb(e) FROM "OrderExchange" e
 UNION ALL SELECT 'shipment', id, xmin::text, to_jsonb(s) FROM "OrderExchangeShipment" s;

-- Second run must do zero writes (including unchanged PostgreSQL tuple xmin).
\ir ../prisma/migrations/20261110210000_normalize_mondial_relay_display_apostrophes/migration.sql
DO $test$
BEGIN
 IF EXISTS (
  SELECT 1 FROM relay_after_first before_row JOIN (
   SELECT 'order'::text AS scope, id, xmin::text AS version, to_jsonb(o) AS row_data FROM "Order" o
   UNION ALL SELECT 'exchange', id, xmin::text, to_jsonb(e) FROM "OrderExchange" e
   UNION ALL SELECT 'shipment', id, xmin::text, to_jsonb(s) FROM "OrderExchangeShipment" s
  ) after_row USING (scope, id)
  WHERE before_row.version IS DISTINCT FROM after_row.version OR before_row.row_data IS DISTINCT FROM after_row.row_data
 ) THEN RAISE EXCEPTION 'Migration not idempotent'; END IF;
END;
$test$;
\ir audit-mondial-relay-apostrophes.sql
SELECT 'PASS: synthetic migration, customer preservation and zero-write second run' AS test_result;
