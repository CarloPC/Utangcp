import { useEffect, useMemo, useState } from 'react';
import { validateImageFile } from '../../utils/gcash';
import { formatCurrency, formatDate, today } from '../../utils/format';
import styles from './GcashPayments.module.css';

const dateOf = (s) => s.createdAt?.toDate?.()?.toISOString().slice(0, 10) || today();

/* ── Owner: upload / replace the store's GCash QR ─────────────── */
function QrSettings({ settings, onSave, onRemove }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setName(settings?.gcash_name || '');
    setNumber(settings?.gcash_number || '');
  }, [settings?.gcash_name, settings?.gcash_number]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    const err = f && validateImageFile(f);
    if (err) {
      setMsg({ type: 'error', text: err });
      e.target.value = '';
      return;
    }
    setMsg(null);
    setFile(f || null);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // QR is uploaded as-is (no re-compression) so it stays scannable.
      await onSave({ file, name, number });
      setFile(null);
      setMsg({ type: 'success', text: 'GCash details saved. Shared passbooks update automatically.' });
    } catch {
      setMsg({ type: 'error', text: 'Could not save. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  const qr = preview || settings?.gcash_qr_url;

  return (
    <div className={styles.card}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>💙 GCash QR for customer payments {settings?.gcash_qr_url ? '✓' : '(not set)'}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.settingsBody}>
          {qr && <img src={qr} alt="GCash QR" className={styles.qrPreview} />}
          <label className={styles.field}>
            <span>QR code image</span>
            <input type="file" accept="image/*" onChange={pick} disabled={busy} />
          </label>
          <label className={styles.field}>
            <span>Account name (shown to customers, optional)</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={busy} />
          </label>
          <label className={styles.field}>
            <span>GCash number (shown to customers, optional)</span>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={20} inputMode="tel" disabled={busy} />
          </label>
          {msg && <p className={msg.type === 'error' ? styles.err : styles.ok}>{msg.text}</p>}
          <div className={styles.row}>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            {settings?.gcash_qr_url && (
              <button type="button" className="btn btn-ghost" onClick={onRemove} disabled={busy}>
                Remove QR
              </button>
            )}
          </div>
          <p className={styles.note}>
            Anyone with a customer's passbook link can see this QR, name and number.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Owner: one pending submission ────────────────────────────── */
function PendingCard({ sub, duplicate, onApprove, onReject, onZoom }) {
  const [amount, setAmount] = useState(String(sub.amount));
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch {
      setErr('Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.sub}>
      <button type="button" className={styles.thumbBtn} onClick={() => onZoom(sub.receiptUrl)} aria-label="View receipt full size">
        <img src={sub.receiptUrl} alt="GCash receipt" className={styles.thumb} loading="lazy" />
      </button>
      <div className={styles.subBody}>
        <p className={styles.who}>
          <strong>{sub.customerName}</strong>
          {sub.productName && <span> · {sub.productName}</span>}
        </p>
        <p className={styles.meta}>
          Ref <b>{sub.referenceNo}</b> · {formatDate(dateOf(sub))}
        </p>
        {duplicate && <p className={styles.warn}>⚠ Same reference number appears in another submission.</p>}

        {!rejecting ? (
          <div className={styles.actions}>
            <label className={styles.amt}>
              ₱
              <input type="number" min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} aria-label="Amount to record" />
            </label>
            <button type="button" className="btn btn-success btn-sm" disabled={busy || !(Number(amount) > 0)}
              onClick={() => run(() => onApprove(sub, amount, dateOf(sub)))}>
              {busy ? 'Saving…' : 'Approve'}
            </button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <input className="input" placeholder="Reason (optional, customer sees it)" value={reason} maxLength={200}
              onChange={(e) => setReason(e.target.value)} disabled={busy} />
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => onReject(sub, reason))}>
              Confirm reject
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setRejecting(false)}>
              Back
            </button>
          </div>
        )}
        {err && <p className={styles.err}>{err}</p>}
      </div>
    </div>
  );
}

/* ── Main block shown above Payment History ───────────────────── */
export default function GcashPayments({ settings, onSaveSettings, onRemoveQr, pending, reviewed, onApprove, onReject, onRemove }) {
  const [zoom, setZoom] = useState(null);
  const [showReviewed, setShowReviewed] = useState(false);

  const dupRefs = useMemo(() => {
    const count = new Map();
    [...pending, ...reviewed].forEach((s) => {
      const k = String(s.referenceNo).replace(/\s|-/g, '').toLowerCase();
      count.set(k, (count.get(k) || 0) + 1);
    });
    return count;
  }, [pending, reviewed]);
  const isDup = (s) => dupRefs.get(String(s.referenceNo).replace(/\s|-/g, '').toLowerCase()) > 1;

  return (
    <div className={styles.wrap}>
      <QrSettings settings={settings} onSave={onSaveSettings} onRemove={onRemoveQr} />

      <div className={styles.card}>
        <h3 className={styles.title}>
          GCash payments to review {pending.length > 0 && <span className={styles.count}>{pending.length}</span>}
        </h3>
        {pending.length === 0 ? (
          <p className={styles.empty}>No pending receipts.</p>
        ) : (
          pending.map((s) => (
            <PendingCard key={s.id} sub={s} duplicate={isDup(s)} onApprove={onApprove} onReject={onReject} onZoom={setZoom} />
          ))
        )}

        {reviewed.length > 0 && (
          <>
            <button type="button" className={styles.linkBtn} onClick={() => setShowReviewed((v) => !v)}>
              {showReviewed ? 'Hide' : 'Show'} reviewed ({reviewed.length})
            </button>
            {showReviewed &&
              reviewed.map((s) => (
                <div key={s.id} className={styles.reviewed}>
                  <button type="button" className={styles.thumbBtnSm} onClick={() => setZoom(s.receiptUrl)} aria-label="View receipt">
                    <img src={s.receiptUrl} alt="" className={styles.thumbSm} loading="lazy" />
                  </button>
                  <div className={styles.subBody}>
                    <p className={styles.who}><strong>{s.customerName}</strong> · {formatCurrency(s.approvedAmount ?? s.amount)}</p>
                    <p className={styles.meta}>Ref {s.referenceNo} · {formatDate(dateOf(s))}</p>
                  </div>
                  <span className={s.status === 'approved' ? styles.badgeOk : styles.badgeNo}>
                    {s.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(s)} aria-label="Delete record">✕</button>
                </div>
              ))}
          </>
        )}
      </div>

      {zoom && (
        <div className={styles.lightbox} onClick={() => setZoom(null)} role="dialog" aria-label="Receipt">
          <img src={zoom} alt="GCash receipt" onClick={(e) => e.stopPropagation()} />
          <button type="button" className={styles.lbClose} onClick={() => setZoom(null)} aria-label="Close">✕</button>
        </div>
      )}
    </div>
  );
}
