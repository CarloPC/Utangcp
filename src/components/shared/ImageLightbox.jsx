import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ImageLightbox.module.css';

const cx = (...c) => c.filter(Boolean).join(' ');

/**
 * Full-screen photo viewer. Click the backdrop, press Esc, or tap ✕ to close.
 * Rendered in a portal on <body> so it always covers the whole screen, even
 * when opened from inside a modal.
 */
export function ImageLightbox({ src, alt = '', caption, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Capture phase + stopPropagation so Esc closes only the photo and not
    // whatever modal/passbook is open underneath it.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);

    // Lock page scroll while the preview is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Photo preview'}
      onClick={(e) => {
        // React events bubble through portals — don't let this click reach
        // the modal that the photo lives in.
        e.stopPropagation();
        onClose();
      }}
    >
      <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close photo">
        ✕
      </button>

      <div className={styles.stage}>
        {!loaded && !failed && <span className={styles.placeholder} />}
        {failed ? (
          <p className={styles.error}>Couldn’t load this photo.</p>
        ) : (
          <img
            src={src}
            alt={alt}
            className={cx(styles.img, loaded && styles.loaded)}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {caption && <p className={styles.caption}>{caption}</p>}
    </div>,
    document.body
  );
}

/**
 * Drop-in replacement for <img> that opens the full-screen preview when
 * clicked (or when Enter/Space is pressed while focused).
 */
export default function ZoomableImage({ src, alt = '', caption, className, style }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={cx(className, styles.zoomable)}
        style={style}
        role="button"
        tabIndex={0}
        title="Click to view full photo"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
      />
      {open && (
        <ImageLightbox src={src} alt={alt} caption={caption ?? alt} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
