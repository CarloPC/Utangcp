import { useState } from 'react';
import { formatDate } from '../../utils/format';
import { buildGroupUrl } from '../../utils/passbook';
import styles from './ShareLinks.module.css';

/** Confirm + name the list before creating a bulk link. */
export function BulkShareModal({ names, defaultTitle, loading, error, onConfirm, onCancel }) {
  const [title, setTitle] = useState(defaultTitle);
  const preview = names.slice(0, 6);
  return (
    <div className={styles.overlay} onClick={loading ? undefined : onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className={styles.title}>Bulk Share {names.length} {names.length === 1 ? 'customer' : 'customers'}</h3>

        <label className="label" htmlFor="bulk_title">List title (customers will see this)</label>
        <input
          id="bulk_title"
          className="input"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Lenet family accounts"
        />

        <p className={styles.preview}>
          {preview.join(', ')}
          {names.length > preview.length && ` and ${names.length - preview.length} more`}
        </p>

        <p className={styles.warn}>
          Anyone with this link can see the name, item, balance and payments of <strong>every customer in this list</strong>.
          Only share it with people who should see all of them. You can revoke it at any time.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onConfirm(title)} disabled={loading}>
            {loading ? 'Creating link…' : '🔗 Create & Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Active bulk links, each with Copy + Revoke. */
export function SharedLinksPanel({ groups, onCopy, onRevoke }) {
  if (!groups.length) return null;
  return (
    <details className={styles.panel}>
      <summary>🔗 Shared links ({groups.length})</summary>
      <ul className={styles.list}>
        {groups.map((g) => {
          const created = g.createdAt?.toDate?.();
          return (
            <li key={g.id} className={styles.item}>
              <div className={styles.itemText}>
                <strong>{g.title}</strong>
                <span>
                  {(g.memberIds || []).length} customers
                  {created && `, created ${formatDate(created.toISOString().slice(0, 10))}`}
                </span>
                <code className={styles.url}>{buildGroupUrl(g.id)}</code>
              </div>
              <div className={styles.itemBtns}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onCopy(g)}>Copy link</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => onRevoke(g)}>Revoke</button>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
