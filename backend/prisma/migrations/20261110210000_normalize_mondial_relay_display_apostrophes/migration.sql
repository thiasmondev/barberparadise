-- Display-only cleanup of existing relay data. ASCII repeated apostrophes only.
-- NEVER update ShippingAddress, Customer, Address, billingAddress or
-- shippingAddressSnapshot. Preserve accents, single/typographic apostrophes,
-- relay identifiers, postal codes, countries, JSON types and unknown keys.
BEGIN;

UPDATE "Order"
SET "relayPointName" = regexp_replace("relayPointName", $pattern$'{2,}$pattern$, $replacement$'$replacement$, 'g'),
    "relayPointAddress" = regexp_replace("relayPointAddress", $pattern$'{2,}$pattern$, $replacement$'$replacement$, 'g')
WHERE "relayPointName" ~ $pattern$'{2,}$pattern$
   OR "relayPointAddress" ~ $pattern$'{2,}$pattern$;

WITH normalized AS (
  SELECT exchange.id,
         jsonb_object_agg(entry.key,
           CASE WHEN entry.key IN ('name', 'address', 'city', 'fullAddress', 'relayPointName', 'relayPointAddress')
                     AND jsonb_typeof(entry.value) = 'string'
                THEN to_jsonb(regexp_replace(entry.value #>> '{}', $pattern$'{2,}$pattern$, $replacement$'$replacement$, 'g'))
                ELSE entry.value END) AS snapshot
  FROM "OrderExchange" AS exchange
  CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(exchange."relayPointSnapshot") = 'object'
         THEN exchange."relayPointSnapshot" ELSE '{}'::jsonb END
  ) AS entry
  GROUP BY exchange.id
)
UPDATE "OrderExchange" AS exchange
SET "relayPointSnapshot" = normalized.snapshot
FROM normalized
WHERE exchange.id = normalized.id
  AND exchange."relayPointSnapshot" IS DISTINCT FROM normalized.snapshot;

WITH normalized AS (
  SELECT shipment.id,
         jsonb_object_agg(entry.key,
           CASE WHEN entry.key IN ('name', 'address', 'city', 'fullAddress', 'relayPointName', 'relayPointAddress')
                     AND jsonb_typeof(entry.value) = 'string'
                THEN to_jsonb(regexp_replace(entry.value #>> '{}', $pattern$'{2,}$pattern$, $replacement$'$replacement$, 'g'))
                ELSE entry.value END) AS snapshot
  FROM "OrderExchangeShipment" AS shipment
  CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(shipment."relayPointSnapshot") = 'object'
         THEN shipment."relayPointSnapshot" ELSE '{}'::jsonb END
  ) AS entry
  GROUP BY shipment.id
)
UPDATE "OrderExchangeShipment" AS shipment
SET "relayPointSnapshot" = normalized.snapshot
FROM normalized
WHERE shipment.id = normalized.id
  AND shipment."relayPointSnapshot" IS DISTINCT FROM normalized.snapshot;

COMMIT;
