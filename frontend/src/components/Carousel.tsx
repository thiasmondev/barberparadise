"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getActiveCarouselSlides, type CarouselSlide } from "@/lib/api";

const AUTOPLAY_DELAY_MS = 5000;

type CtaShape = "rounded" | "square";

type CtaMetadata = {
  x: number;
  y: number;
  backgroundColor: string;
  textColor: string;
  shadow: boolean;
  shape: CtaShape;
};

const defaultCtaMetadata: CtaMetadata = {
  x: 50,
  y: 76,
  backgroundColor: "#E91E63",
  textColor: "#FFFFFF",
  shadow: true,
  shape: "rounded",
};

function slideLabel(slide: CarouselSlide) {
  return slide.title || slide.imageAlt || "Voir la sélection Barber Paradise";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.min(96, Math.max(4, value));
}

function normalizeHexColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value.trim()) ? value.trim() : fallback;
}

function getCtaMetadata(slide: CarouselSlide): CtaMetadata {
  if (!isRecord(slide.metadata) || !isRecord(slide.metadata.cta)) return defaultCtaMetadata;
  const cta = slide.metadata.cta;
  return {
    x: clampPercent(Number(cta.x ?? defaultCtaMetadata.x)),
    y: clampPercent(Number(cta.y ?? defaultCtaMetadata.y)),
    backgroundColor: normalizeHexColor(cta.backgroundColor, defaultCtaMetadata.backgroundColor),
    textColor: normalizeHexColor(cta.textColor, defaultCtaMetadata.textColor),
    shadow: typeof cta.shadow === "boolean" ? cta.shadow : defaultCtaMetadata.shadow,
    shape: cta.shape === "square" ? "square" : "rounded",
  };
}

function ctaInlineStyle(cta: CtaMetadata): CSSProperties {
  return {
    left: `${cta.x}%`,
    top: `${cta.y}%`,
    backgroundColor: cta.backgroundColor,
    color: cta.textColor,
    borderRadius: cta.shape === "rounded" ? "9999px" : "0px",
    boxShadow: cta.shadow ? "0 18px 40px rgba(0,0,0,0.35)" : "none",
    transform: "translate(-50%, -50%)",
  };
}

function SlideImage({ slide, index }: { slide: CarouselSlide; index: number }) {
  return (
    <picture>
      {slide.imageMobileUrl ? <source media="(max-width: 767px)" srcSet={slide.imageMobileUrl} /> : null}
      <Image
        src={slide.imageUrl}
        alt={slide.imageAlt || slide.title || "Barber Paradise"}
        fill
        priority={index === 0}
        sizes="100vw"
        className="object-cover object-center"
      />
    </picture>
  );
}

function SlideContent({ slide, index }: { slide: CarouselSlide; index: number }) {
  const hasCtaButton = Boolean(slide.ctaText?.trim() && slide.ctaLink?.trim());
  const cta = getCtaMetadata(slide);

  return (
    <>
      <SlideImage slide={slide} index={index} />
      {hasCtaButton ? (
        <Link
          href={slide.ctaLink || "#"}
          aria-label={slideLabel(slide)}
          className="absolute z-10 whitespace-nowrap px-5 py-3 text-xs font-black uppercase tracking-wide transition hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black sm:px-6 sm:text-sm md:px-8 md:py-4"
          style={ctaInlineStyle(cta)}
        >
          {slide.ctaText}
        </Link>
      ) : null}
    </>
  );
}

export default function Carousel() {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getActiveCarouselSlides()
      .then((items) => {
        if (!isMounted) return;
        setSlides(items);
        setCurrentIndex(0);
      })
      .catch((error) => {
        console.warn("[Carousel] Impossible de charger les slides", error);
      })
      .finally(() => {
        if (isMounted) setHasLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const slideCount = slides.length;
  const hasMultipleSlides = slideCount > 1;

  const goToSlide = useCallback(
    (index: number) => {
      if (!slideCount) return;
      setCurrentIndex((index + slideCount) % slideCount);
    },
    [slideCount]
  );

  const nextSlide = useCallback(() => goToSlide(currentIndex + 1), [currentIndex, goToSlide]);
  const previousSlide = useCallback(() => goToSlide(currentIndex - 1), [currentIndex, goToSlide]);

  useEffect(() => {
    if (!hasMultipleSlides || isPaused) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % slideCount);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [hasMultipleSlides, isPaused, slideCount]);

  const currentSlide = slides[currentIndex];

  const regionLabel = useMemo(() => {
    if (!currentSlide?.title) return "Carrousel des actualités Barber Paradise";
    return `Carrousel Barber Paradise — ${currentSlide.title}`;
  }, [currentSlide?.title]);

  if (hasLoaded && slideCount === 0) return null;
  if (!currentSlide) return null;

  return (
    <section
      className="relative isolate w-full overflow-hidden bg-black"
      aria-label={regionLabel}
      role="region"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") previousSlide();
        if (event.key === "ArrowRight") nextSlide();
      }}
      tabIndex={0}
    >
      <div className="relative aspect-square w-full md:aspect-video">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const hasCtaButton = Boolean(slide.ctaText?.trim() && slide.ctaLink?.trim());
          const containerClassName = `absolute inset-0 transition-opacity duration-700 ease-out ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`;

          return hasCtaButton ? (
            <div key={slide.id} className={containerClassName} aria-hidden={!isActive}>
              <SlideContent slide={slide} index={index} />
            </div>
          ) : slide.ctaLink ? (
            <Link key={slide.id} href={slide.ctaLink} aria-label={slideLabel(slide)} className={containerClassName} aria-hidden={!isActive} tabIndex={isActive ? 0 : -1}>
              <SlideImage slide={slide} index={index} />
            </Link>
          ) : (
            <div key={slide.id} className={containerClassName} aria-hidden={!isActive}>
              <SlideImage slide={slide} index={index} />
            </div>
          );
        })}

        {hasMultipleSlides ? (
          <>
            <button
              type="button"
              aria-label="Afficher la slide précédente"
              onClick={previousSlide}
              className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-2xl text-white backdrop-blur transition hover:bg-black/55 md:flex"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Afficher la slide suivante"
              onClick={nextSlide}
              className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-2xl text-white backdrop-blur transition hover:bg-black/55 md:flex"
            >
              ›
            </button>
            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2" aria-label="Navigation du carrousel">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Afficher la slide ${index + 1}`}
                  aria-current={index === currentIndex}
                  onClick={() => goToSlide(index)}
                  className={`h-2.5 rounded-full transition-all ${index === currentIndex ? "w-8 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70"}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
