import assert from "node:assert/strict";
import { validateBlogImageAttributions } from "./blogVisualService";

const valid = validateBlogImageAttributions([
  {
    provider: "Pexels",
    photographer: "Alex Martin",
    photographerUrl: "https://www.pexels.com/fr-fr/@alex-martin/",
    sourceUrl: "https://www.pexels.com/fr-fr/photo/exemple-123/",
    photoId: "123",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/blog.webp",
  },
]);

assert.equal(valid.length, 1, "Un crédit Pexels complet doit être conservé.");
assert.equal(valid[0].photographer, "Alex Martin");
assert.equal(valid[0].imageUrl, "https://res.cloudinary.com/demo/image/upload/blog.webp");

const invalid = validateBlogImageAttributions([
  { provider: "Unknown", photographer: "Sans licence", photographerUrl: "https://example.test", sourceUrl: "https://example.test", photoId: "1" },
  { provider: "Pexels", photographer: "", photographerUrl: "https://pexels.com", sourceUrl: "https://pexels.com", photoId: "2" },
]);
assert.equal(invalid.length, 0, "Une attribution incomplète ou d’une autre source ne doit pas être persistée.");

console.log("✅ blogVisualService: crédits Pexels validés");
