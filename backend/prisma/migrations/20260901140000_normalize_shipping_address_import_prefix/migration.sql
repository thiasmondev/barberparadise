-- Les exports Excel/CSV peuvent préfixer les champs texte par une apostrophe
-- (ex. '01250 ou '0612345678). Ne supprimer que ces apostrophes de préfixe.
-- Les préfixes internationaux (+33, +32, etc.) et tous les autres caractères restent intacts.

UPDATE "ShippingAddress"
SET "postalCode" = regexp_replace("postalCode", '^[''‘’ʼ]+[[:space:]]*', '')
WHERE "postalCode" ~ '^[''‘’ʼ]';

UPDATE "ShippingAddress"
SET phone = regexp_replace(phone, '^[''‘’ʼ]+[[:space:]]*', '')
WHERE phone ~ '^[''‘’ʼ]';
