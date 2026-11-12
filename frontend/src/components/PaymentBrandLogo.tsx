import Image from "next/image";

const BRAND_ASSETS: Record<string, { src: string; alt: string; width: number; height: number }> = {
  paypal: { src: "/payments/paypal.png", alt: "PayPal", width: 2497, height: 839 },
  paypal_4x: { src: "/payments/paypal.png", alt: "PayPal", width: 2497, height: 839 },
  apple_pay: { src: "/payments/apple-pay.svg", alt: "Apple Pay", width: 165, height: 105 },
  google_pay: { src: "/payments/google-pay.png", alt: "Google Pay", width: 752, height: 400 },
};

export function hasPaymentBrandLogo(method: string): boolean {
  return method === "card" || Boolean(BRAND_ASSETS[method]);
}

/** Official acceptance marks only; does not replace a provider's functional payment button. */
export default function PaymentBrandLogo({ method }: { method: string }) {
  if (method === "card") {
    return (
      <span className="inline-flex h-12 w-28 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-2 py-3">
        <Image src="/payments/cb.svg" alt="CB" width={28} height={22} unoptimized loading="eager" className="h-5 w-6 object-contain" />
        <Image src="/payments/visa.png" alt="Visa" width={208} height={68} unoptimized loading="eager" className="h-5 w-7 object-contain" />
        <Image src="/payments/mastercard.svg" alt="Mastercard" width={80} height={50} unoptimized loading="eager" className="h-5 w-6 object-contain" />
      </span>
    );
  }
  const asset = BRAND_ASSETS[method];
  if (!asset) return null;
  return (
    <span className="inline-flex h-12 w-24 shrink-0 items-center justify-center rounded-md bg-white px-3 py-3">
      <Image src={asset.src} alt={asset.alt} width={asset.width} height={asset.height} unoptimized loading="eager" className="h-6 w-full object-contain" />
    </span>
  );
}
