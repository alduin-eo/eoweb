import { useEffect, useState } from 'preact/hooks';
import { GfxType } from '@/gfx';
import { useClient } from '@/ui/context';

// Module-level object URL cache keyed by graphicId (survives re-renders)
const urlCache = new Map<number, string>();
// One load per graphic at a time (many icons of the same item can mount together)
const inflight = new Map<number, Promise<string>>();

type GfxLoader = {
  loadResource(fileID: number, resourceID: number): Promise<ImageBitmap>;
};

async function renderItemUrl(
  gfxLoader: GfxLoader,
  graphicId: number,
): Promise<string> {
  // The loader's LRU cache closes evicted bitmaps, so a bitmap can be closed before we draw it
  // when many icons load at once; the loader then reloads it on the next request.
  for (let attempt = 0; ; attempt++) {
    const bitmap = await gfxLoader.loadResource(
      GfxType.Items,
      100 + graphicId * 2,
    );
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return URL.createObjectURL(blob);
    } catch (e) {
      if (attempt >= 1) throw e;
    }
  }
}

async function loadItemUrl(
  gfxLoader: GfxLoader,
  graphicId: number,
): Promise<string> {
  const cached = urlCache.get(graphicId);
  if (cached) return cached;

  let pending = inflight.get(graphicId);
  if (!pending) {
    pending = renderItemUrl(gfxLoader, graphicId)
      .then((url) => {
        urlCache.set(graphicId, url);
        return url;
      })
      .finally(() => inflight.delete(graphicId));
    inflight.set(graphicId, pending);
  }
  return pending;
}

type Props = {
  graphicId: number;
  alt?: string;
  class?: string;
};

export function ItemIcon({ graphicId, alt = '', class: className }: Props) {
  const client = useClient();
  const [src, setSrc] = useState<string | null>(
    () => urlCache.get(graphicId) ?? null,
  );

  useEffect(() => {
    if (src) return;
    let cancelled = false;
    loadItemUrl(client.gfxLoader, graphicId)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        // icon unavailable: keep the placeholder
      });
    return () => {
      cancelled = true;
    };
  }, [client, graphicId, src]);

  if (!src) {
    return <div class={`skeleton ${className ?? ''}`} />;
  }

  return <img src={src} alt={alt} class={className} />;
}
