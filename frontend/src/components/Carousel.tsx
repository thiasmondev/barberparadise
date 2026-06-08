"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getActiveCarouselSlides, type CarouselSlide } from "@/lib/api";

const AUTOPLAY_DELAY_MS = 5000;

function textAlignment(position: string) {
  switch (position) {
    case "center":
      return "items-center text-center mx-auto";
    case "right":
      return "items-end text-right ml-auto";
    default:
      return "items-start text-left mr-auto";
  }
}

function ctaClasses(style?: string | null) {
  if (style === "secondary") {
    return "border border-white/80 bg-white/15 text-white hover:bg-white/25";
  }
  if (style === "outline") {
    return "border border-white text-white hover:bg-white hover:text-black";
  }
  return "bg-white text-black hover:bg-neutral-200";
}

function normalizeOverlayOpacity(value: number) {
  if (!Number.isFinite(value)) return 0.3;
  return Math.min(0.85, Math.max(0, value));
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
      <div className="relative aspect-square w-full md:aspect-[1920/600]">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!isActive}
            >
              <picture>
                {slide.imageMobileUrl ? <source media="(max-width: 767px)" srcSet={slide.imageMobileUrl} /> : null}
                <Image
                  src={slide.imageUrl}
                  alt={slide.imageAlt || slide.title || "Barber Paradise"}
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  className="object-cover"
                />
              </picture>
            </div>
          );
        })}

        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0, 0, 0, ${normalizeOverlayOpacity(currentSlide.overlayOpacity)})` }}
        />

        <div className="absolute inset-0 flex items-center px-5 py-10 md:px-12 lg:px-20">
          <div className={`flex max-w-2xl flex-col gap-3 md:gap-5 ${textAlignment(currentSlide.textPosition)}`} style={{ color: currentSlide.textColor || "#FFFFFF" }}>
            {currentSlide.subtitle ? (
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/90 md:text-sm">{currentSlide.subtitle}</p>
            ) : null}
            {currentSlide.title ? (
              <h2 className="text-3xl font-black uppercase leading-tight tracking-tight md:text-5xl lg:text-6xl">{currentSlide.title}</h2>
            ) : null}
            {currentSlide.description ? (
              <p className="max-w-xl text-sm leading-6 text-white/90 md:text-lg md:leading-8">{currentSlide.description}</p>
            ) : null}
            {currentSlide.ctaText && currentSlide.ctaLink ? (
              <Link
                href={currentSlide.ctaLink}
                className={`mt-2 inline-flex rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide transition ${ctaClasses(currentSlide.ctaStyle)}`}
              >
                {currentSlide.ctaText}
              </Link>
            ) : null}
          </div>
        </div>

        {hasMultipleSlides ? (
          <>
            <button
              type="button"
              aria-label="Afficher la slide précédente"
              onClick={previousSlide}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-2xl text-white backdrop-blur transition hover:bg-black/55 md:flex"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Afficher la slide suivante"
              onClick={nextSlide}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-2xl text-white backdrop-blur transition hover:bg-black/55 md:flex"
            >
              ›
            </button>
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2" aria-label="Navigation du carrousel">
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
