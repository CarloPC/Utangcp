import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ChatWindow from './ChatWindow';
import styles from './PassbookChat.module.css';

/**
 * Customer-side chat screen, opened from the 💬 button in the passbook.
 * Renders above the passbook as its own full-screen "tab".
 */
export default function PassbookChat({ passbook, onClose }) {
  const fullName = `${passbook.firstname} ${passbook.lastname}`.trim();

  // Used to create the conversation the first time the customer writes
  const meta = useMemo(
    () => ({
      ownerId: passbook.ownerId,
      customerName: fullName.slice(0, 120),
      productName: (passbook.product_name || '').slice(0, 120),
    }),
    [passbook.ownerId, passbook.product_name, fullName]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Chat with the store"
        onClick={(e) => e.stopPropagation()}
      >
        <ChatWindow
          creditId={passbook.creditId}
          role="customer"
          meta={meta}
          title={passbook.owner?.name || 'Store owner'}
          photoUrl={passbook.owner?.photo_url || null}
          subtitle={passbook.owner?.name ? 'Store owner' : `${fullName}${passbook.product_name ? ` • ${passbook.product_name}` : ''}`}
          onClose={onClose}
          closeLabel="Close chat"
        />
      </div>
    </div>,
    document.body
  );
}
