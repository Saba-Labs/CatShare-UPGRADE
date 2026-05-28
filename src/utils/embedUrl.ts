/** Normalize common video/map URLs into iframe-friendly embed URLs. */
export function normalizeEmbedUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      let videoId = url.searchParams.get('v');
      if (!videoId && url.hostname.includes('youtu.be')) {
        videoId = url.pathname.replace(/^\//, '');
      }
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }

    if (url.hostname.includes('google.') && url.pathname.includes('/maps')) {
      return trimmed;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

export function isEmbeddableUrl(url: string): boolean {
  const normalized = normalizeEmbedUrl(url);
  return /^https?:\/\//i.test(normalized);
}
