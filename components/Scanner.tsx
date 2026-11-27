"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import type { Lang } from "@/lib/types";

interface DetectorLike {
  detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}

export function Scanner({ lang, onCode }: { lang: Lang; onCode: (c: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  const cb = useRef(onCode);
  useEffect(() => {
    cb.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
    const detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;

    const tick = async () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2) {
        let found: string | null = null;
        if (detector) {
          try {
            const r = await detector.detect(v);
            if (r[0]) found = r[0].rawValue;
          } catch {
            /* fall through to jsQR */
          }
        }
        if (!found && ctx) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const r = jsQR(img.data, img.width, img.height);
          if (r) found = r.data;
        }
        if (found) {
          cb.current(found);
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    (async () => {
      if (!navigator.mediaDevices) throw new Error("no camera");
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    })()
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        raf = requestAnimationFrame(() => void tick());
      })
      .catch(() => setErr(true));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (err) return <p className="rounded-[14px] bg-mark-soft px-4 py-3 text-[17px]">{lang === "kk" ? "Камера қолжетімсіз — кодты қолмен енгізіңіз." : "Камера недоступна — введите код вручную."}</p>;
  return <video ref={video} playsInline muted className="aspect-square w-full max-w-[320px] rounded-[16px] border border-line object-cover" />;
}
