import { CATSHARE_MARKETING_URL } from '../../constants/catshareBranding';

interface CatSharePoweredByProps {
  /** Builder canvas: show link styling but no navigation. */
  previewMode?: boolean;
}

/** Site attribution displayed when enabled in footer settings. */
export default function CatSharePoweredBy({ previewMode }: CatSharePoweredByProps) {
  return (
    <div className="sf-footer-powered-by" aria-label="Powered by CatShare">
      Powered by{' '}
      {previewMode ? (
        <span className="sf-footer-powered-by-link">CatShare</span>
      ) : (
        <a
          href={CATSHARE_MARKETING_URL}
          className="sf-footer-powered-by-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          CatShare
        </a>
      )}
    </div>
  );
}
