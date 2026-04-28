type SearchParamsLike = {
  get(name: string): string | null;
  toString(): string;
};

export function isExactActiveHref(
  pathname: string,
  searchParams: SearchParamsLike,
  href: string,
): boolean {
  const [hrefPath, hrefQuery = ""] = href.split("?");
  if (pathname !== hrefPath) return false;

  const expectedParams = new URLSearchParams(hrefQuery);
  if (expectedParams.toString() === "") {
    return searchParams.toString() === "";
  }

  let matches = true;
  expectedParams.forEach((value, key) => {
    if (searchParams.get(key) !== value) matches = false;
  });

  return matches;
}
