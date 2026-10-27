import { useEffect, useRef, useState } from 'react';
import { useMySubmissions } from '../../hooks/useMySubmissions';
import { downloadImage, validateImageFile } from '../../utils/gcash';
import { formatCurrency, formatDate } from '../../utils/format';
import styles from './GcashPayPanel.module.css';

const REF_RE = /^[A-Za-z0-9 -]{4,40}$/;
const STATUS = {
  pending: { label: 'Pending Review', cls: 'pending' },
  approved: { label: 'Approved', cls: 'approved' },
  rejected: { label: 'Rejected', cls: 'rejected' },
};

/**
 * Public "Pay with GCash" section for the customer passbook.
 * Shows the owner's QR (with one-click download) and a receipt form.
 */
export default function GcashPayPanel({ passbook, shareId, balance }) {
  const pay = passbook.payment;
  const { submissions, submit } = useMySubmissions(shareId, passbook);

  const [amount, setAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dlNote, setDlNote] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => setSuccess(false), 8000);
    return () => clearTimeout(t);
  }, [success]);

  if (!pay?.gcash_qr_url || balance <= 0) return null;

  const handleDownload = async () => {
    setDlNote('');
    const ok = await downloadImage(pay.gcash_qr_url, 'gcash-qr');
    if (!ok) setDlNote('Opened the QR in a new tab — press and hold it to save.');
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0] || null;
    const msg = f ? validateImageFile(f) : '';
    if (msg) {
      setError(msg);
      setFile(null);
      e.target.value = '';
      return;
    }
    setError('');
    setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    const amt = Number(amount);
    if (!(amt > 0)) return setError('Enter the amount you paid.');
    if (amt > balance) return setError(`The amount can't be more than your balance (${formatCurrency(balance)}).`);
    if (!REF_RE.test(referenceNo.trim())) return setError('Enter the reference number shown on your GCash receipt.');
    if (!file) return setError('Please attach a screenshot of your GCash receipt.');

    setBusy(true);
    try {
      await submit({ amount: amt, referenceNo, file });
      setSuccess(true);
      setAmount('');
      setReferenceNo('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setError("We couldn't submit your payment. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="Pay with GCash">
      <h2 className={styles.title}>Pay with GCash</h2>
      <p className={styles.sub}>
        Remaining balance: <strong>{formatCurrency(balance)}</strong>
      </p>

      <ol className={styles.steps}>
        <li>Download the QR code below.</li>
        <li>Open GCash → <b>Pay QR</b> → <b>Upload QR</b>, pick the saved image, and pay.</li>
        <li>Come back here and send us your receipt.</li>
      </ol>

      <div className={styles.qrCard}>
        <img src={pay.gcash_qr_url} alt="GCash QR code of the store" className={styles.qr} />
        {(pay.gcash_name || pay.gcash_number) && (
          <p className={styles.payee}>
            {pay.gcash_name && <strong>{pay.gcash_name}</strong>}
            {pay.gcash_number && <span>{pay.gcash_number}</span>}
          </p>
        )}
        <button type="button" className={styles.downloadBtn} onClick={handleDownload}>
          ⬇ Download QR Code
        </button>
        {dlNote && <p className={styles.hint}>{dlNote}</p>}
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h3 className={styles.formTitle}>Already paid? Send your receipt</h3>

        <label className={styles.field}>
          <span>Amount paid (₱)</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            max={balance}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`up to ${balance}`}
            disabled={busy}
          />
        </label>

        <label className={styles.field}>
          <span>Reference number / Transaction ID</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={40}
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder="e.g. 1234 567 890123"
            disabled={busy}
          />
        </label>

        <div className={styles.field}>
          <span>GCash receipt screenshot</span>
          <input
            ref={fileRef}
            className={styles.fileInput}
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={busy}
            aria-label="GCash receipt screenshot"
          />
          {preview && <img src={preview} alt="Receipt preview" className={styles.preview} />}
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {success && (
          <p className={styles.success} role="status">
            Payment submitted! The owner will review your receipt shortly.
          </p>
        )}

        <button type="submit" className={styles.submitBtn} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit Payment for Review'}
        </button>
      </form>

      {submissions.length > 0 && (
        <div className={styles.mine}>
          <h3 className={styles.formTitle}>Your submitted payments</h3>
          <ul>
            {submissions.map((s) => {
              const st = STATUS[s.status] || STATUS.pending;
              const when = s.createdAt?.toDate?.();
              return (
                <li key={s.id}>
                  <div>
                    <strong>{formatCurrency(s.amount)}</strong>
                    <span className={styles.meta}>
                      Ref {s.referenceNo}
                      {when && ` · ${formatDate(when.toISOString().slice(0, 10))}`}
                    </span>
                    {s.status === 'rejected' && s.rejectReason && (
                      <span className={styles.meta}>Reason: {s.rejectReason}</span>
                    )}
                  </div>
                  <span className={`${styles.badge} ${styles[st.cls]}`}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
