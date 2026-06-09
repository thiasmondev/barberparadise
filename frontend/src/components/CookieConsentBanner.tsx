"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_STORAGE_KEY = "rgpd_consent";
type ConsentChoice = "accepted" | "refused";

export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const existingConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    setIsVisible(!existingConsent);
  }, []);

  const saveConsent = (choice: ConsentChoice) => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    window.dispatchEvent(new Event("bp:cookie-consent-updated"));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] border-t border-white/10 bg-[#111111] px-4 py-4 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.35)] sm:px-6">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-white/85 md:max-w-3xl">
          Nous utilisons des cookies pour améliorer votre expérience. En continuant, vous acceptez notre{" "}
          <Link
            href="/politique-de-confidentialite"
            className="font-bold text-[#ffb1c4] underline underline-offset-4 transition-colors hover:text-[#ff4a8d]"
          >
            politique de confidentialité
          </Link>
          .
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => saveConsent("refused")}
            className="rounded-full bg-white/10 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/20"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => saveConsent("accepted")}
            className="rounded-full bg-[#ff4a8d] px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#ff1f70]"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
