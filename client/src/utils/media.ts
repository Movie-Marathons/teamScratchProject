export type Imgish =
  | { poster?: string; image_url?: string; type?: string; is_primary?: boolean }
  | null
  | undefined;

export type Filmish = {
  name?: string;
  poster_url?: string;
  images?: Imgish | Imgish[];
} | null | undefined;

export function resolvePoster(film: Filmish): string {
  if (!film) return '/poster-fallback.svg';

  const imgs = film.images;

  // If images is an array, try primary/poster → first item
  if (Array.isArray(imgs)) {
    const poster =
      imgs.find(i => i?.is_primary || i?.type === 'poster')?.image_url ??
      imgs.find(i => i?.poster)?.poster ??
      imgs[0]?.image_url;
    return poster ?? film.poster_url ?? '/poster-fallback.svg';
  }

  // If images is a single object
  if (imgs && typeof imgs === 'object') {
    return (imgs.poster as string) ?? (imgs.image_url as string) ?? film.poster_url ?? '/poster-fallback.svg';
  }

  // No images
  return film?.poster_url ?? '/poster-fallback.svg';
}