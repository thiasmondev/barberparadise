/** Decode XML text entities once, without resolving DTD/external entities. */
export function decodeXmlText(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g, (entity: string, reference: string) => {
    if (reference[0] !== "#") return named[reference];
    const hexadecimal = reference[1] === "x";
    const codePoint = Number.parseInt(reference.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    // XML 1.0 Char: retain invalid references instead of throwing or corrupting text.
    const valid = codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    return valid ? String.fromCodePoint(codePoint) : entity;
  });
}
