/** Normalize common video/map URLs into iframe-friendly embed URLs. */

function extractYouTubeVideoId(url: URL): string | null {
  if (url.hostname.includes('youtu.be')) {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    return id || null;
  }

  if (!url.hostname.includes('youtube.com') && !url.hostname.includes('youtube-nocookie.com')) {
    return null;
  }

  const fromQuery = url.searchParams.get('v');
  if (fromQuery) return fromQuery;

  const fromPath = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]+)/);
  if (fromPath?.[1]) return fromPath[1];

  return null;
}

function appendEmbedQueryParams(baseUrl: string, params: Record<string, string>): string {
  try {
    const parsed = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}${new URLSearchParams(params).toString()}`;
  }
}

function buildYouTubeEmbedUrl(videoId: string, minimal: boolean): string {
  const host = minimal ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  const base = `${host}/embed/${videoId}`;
  if (!minimal) return base;
  return appendEmbedQueryParams(base, {
    modestbranding: '1',
    rel: '0',
    controls: '1',
    fs: '0',
    iv_load_policy: '3',
    cc_load_policy: '0',
    playsinline: '1',
    autohide: '1',
  });
}

function buildVimeoEmbedUrl(videoId: string, minimal: boolean): string {
  const base = `https://player.vimeo.com/video/${videoId}`;
  if (!minimal) return base;
  return appendEmbedQueryParams(base, {
    title: '0',
    byline: '0',
    portrait: '0',
    badge: '0',
    share: '0',
    dnt: '1',
  });
}

function resolveEmbedUrl(url: URL, minimal: boolean): string | null {
  const youtubeId = extractYouTubeVideoId(url);
  if (youtubeId) return buildYouTubeEmbedUrl(youtubeId, minimal);

  if (url.hostname.includes('vimeo.com')) {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    if (id && id !== 'video') return buildVimeoEmbedUrl(id, minimal);
    const videoMatch = url.pathname.match(/\/video\/(\d+)/);
    if (videoMatch?.[1]) return buildVimeoEmbedUrl(videoMatch[1], minimal);
  }

  return null;
}

export function normalizeEmbedUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

    const hosted = resolveEmbedUrl(url, false);
    if (hosted) return hosted;

    if (url.hostname.includes('google.') && url.pathname.includes('/maps')) {
      return trimmed;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

/** Product gallery embed: minimal chrome (play/pause, timeline; no title/share extras where supported). */
export function normalizeGalleryEmbedUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

    const hosted = resolveEmbedUrl(url, true);
    if (hosted) return hosted;

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
