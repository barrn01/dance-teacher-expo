"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Attendee-stories video that autoplays (muted, looping) once it scrolls into
 * view and pauses when it leaves — the only autoplay browsers allow. The clip
 * has burned-in captions so it reads fine muted; a "Tap for sound" button
 * unmutes on a user gesture (which browsers require to enable audio).
 */
export function AttendeeVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const unmute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    setMuted(false);
    v.play().catch(() => {});
  };

  return (
    <div className="relative mx-auto mt-9 max-w-[860px]">
      <video
        ref={videoRef}
        className="aspect-video w-full rounded-2xl bg-ink shadow-[0_24px_60px_rgba(23,17,20,0.25)]"
        muted={muted}
        loop
        playsInline
        controls
        preload="metadata"
        poster="/media/video/dte-attendee-stories-poster.jpg"
      >
        <source src="/media/video/dte-attendee-stories.mp4" type="video/mp4" />
      </video>

      {muted && (
        <button
          type="button"
          onClick={unmute}
          aria-label="Turn on sound"
          className="absolute left-1/2 top-4 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/85 px-4 py-2 text-[0.78rem] font-extrabold uppercase tracking-[0.08em] text-white shadow-lg ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-ink"
        >
          🔊 Tap for sound
        </button>
      )}
    </div>
  );
}
