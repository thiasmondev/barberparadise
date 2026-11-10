-- Run unchanged BEFORE and AFTER deployment/migration in the authorized DB.
-- Read-only, one consistent snapshot, aggregate counts ONLY: no personal data,
-- order/customer identifiers, address text, email or secrets are returned.
-- rows_with_doubled_ascii_apostrophes counts rows, not occurrences.
-- Preserved client counters should not change because of this migration;
-- target relay counters should be zero after migration (absent concurrent old writes).
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

WITH relay_snapshots AS (
  SELECT 'relay.OrderExchange.relayPointSnapshot'::text AS scope, "relayPointSnapshot" AS snapshot
  FROM "OrderExchange"
  UNION ALL
  SELECT 'relay.OrderExchangeShipment.relayPointSnapshot', "relayPointSnapshot"
  FROM "OrderExchangeShipment"
),
relay_snapshot_flags AS (
  SELECT scope,
         EXISTS (
           SELECT 1 FROM jsonb_each(
             CASE WHEN jsonb_typeof(snapshot) = 'object' THEN snapshot ELSE '{}'::jsonb END
           ) AS entry
           WHERE entry.key IN ('name', 'address', 'city', 'fullAddress', 'relayPointName', 'relayPointAddress')
             AND jsonb_typeof(entry.value) = 'string'
             AND (entry.value #>> '{}') ~ $pattern$'{2,}$pattern$
         ) AS has_doubles
  FROM relay_snapshots
),
counts AS (
  SELECT 'client.ShippingAddress.address_extension_city'::text AS scope,
         count(*) AS total_rows,
         count(*) FILTER (WHERE address ~ $pattern$'{2,}$pattern$
           OR extension ~ $pattern$'{2,}$pattern$ OR city ~ $pattern$'{2,}$pattern$) AS rows_with_doubled_ascii_apostrophes
  FROM "ShippingAddress"
  UNION ALL
  SELECT 'client.Address.address_extension_city', count(*),
         count(*) FILTER (WHERE address ~ $pattern$'{2,}$pattern$
           OR extension ~ $pattern$'{2,}$pattern$ OR city ~ $pattern$'{2,}$pattern$)
  FROM "Address"
  UNION ALL
  SELECT 'client.Customer.firstName_lastName', count(*),
         count(*) FILTER (WHERE "firstName" ~ $pattern$'{2,}$pattern$ OR "lastName" ~ $pattern$'{2,}$pattern$)
  FROM "Customer"
  UNION ALL
  SELECT 'client.OrderExchange.shippingAddressSnapshot', count(*),
         count(*) FILTER (WHERE jsonb_typeof("shippingAddressSnapshot") = 'object' AND (
           ("shippingAddressSnapshot" ->> 'address') ~ $pattern$'{2,}$pattern$
           OR ("shippingAddressSnapshot" ->> 'extension') ~ $pattern$'{2,}$pattern$
           OR ("shippingAddressSnapshot" ->> 'city') ~ $pattern$'{2,}$pattern$
           OR ("shippingAddressSnapshot" ->> 'firstName') ~ $pattern$'{2,}$pattern$
           OR ("shippingAddressSnapshot" ->> 'lastName') ~ $pattern$'{2,}$pattern$))
  FROM "OrderExchange"
  UNION ALL
  SELECT 'client.Order.billingAddress', count(*),
         count(*) FILTER (WHERE jsonb_typeof("billingAddress") = 'object' AND (
           ("billingAddress" ->> 'address') ~ $pattern$'{2,}$pattern$
           OR ("billingAddress" ->> 'extension') ~ $pattern$'{2,}$pattern$
           OR ("billingAddress" ->> 'city') ~ $pattern$'{2,}$pattern$))
  FROM "Order"
  UNION ALL
  SELECT 'relay.Order.relayPointName', count(*),
         count(*) FILTER (WHERE "relayPointName" ~ $pattern$'{2,}$pattern$)
  FROM "Order"
  UNION ALL
  SELECT 'relay.Order.relayPointAddress', count(*),
         count(*) FILTER (WHERE "relayPointAddress" ~ $pattern$'{2,}$pattern$)
  FROM "Order"
  UNION ALL
  SELECT expected.scope, count(flags.scope), count(flags.scope) FILTER (WHERE flags.has_doubles)
  FROM (VALUES ('relay.OrderExchange.relayPointSnapshot'), ('relay.OrderExchangeShipment.relayPointSnapshot')) AS expected(scope)
  LEFT JOIN relay_snapshot_flags AS flags ON flags.scope = expected.scope
  GROUP BY expected.scope
)
SELECT scope, total_rows, rows_with_doubled_ascii_apostrophes FROM counts ORDER BY scope;

COMMIT;
