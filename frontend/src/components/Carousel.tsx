"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getActiveCarouselSlides, type CarouselSlide } from "@/lib/api";

const AUTOPLAY_DELAY_MS = 5000;

function slideLabel(slide: CarouselSlide) {
  return slide.title || slide.imageAlt || "Voir la sélection Barber Paradise";
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
          const containerClassName = `absolute inset-0 transition-opacity duration-700 ease-out ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`;

          return slide.ctaLink ? (
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
