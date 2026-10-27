import { useEffect, useMemo, useRef, useState } from 'react';
import { useMySubmissions } from '../../hooks/useMySubmissions';
import {
  consumeArrival,
  downloadImage,
  externalBrowserUrl,
  isInAppBrowser,
  openInExternalBrowser,
  validateImageFile,
} from '../../utils/gcash';
import { copyText } from '../../utils/passbook';
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
export default function GcashPayPanel({ passbook, shareId, groupId, balance }) {
  const pay = passbook.payment;
  const { submissions, submit } = useMySubmissions({ shareId, groupId }, passbook);

  const [amount, setAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false); // "press and hold to save" sheet
  const [copied, setCopied] = useState(false);
  const inApp = useMemo(isInAppBrowser, []);
  const [arrived, setArrived] = useState(false); // came from Messenger -> QR auto-saved
  const panelRef = useRef(null);
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

  // Customer tapped "Open in browser" in Messenger: save the QR right away and
  // tell them what to do next.
  const qrUrl = pay?.gcash_qr_url;
  const creditId = passbook.creditId;
  useEffect(() => {
    if (inApp || !qrUrl || balance <= 0) return;
    if (!consumeArrival(creditId)) return;
    setArrived(true);
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    downloadImage(qrUrl, 'gcash-qr').then((ok) => {
      if (!ok) setSaveOpen(true);
    });
  }, [inApp, qrUrl, balance, creditId]);

  if (!pay?.gcash_qr_url || balance <= 0) return null;

  const handleDownload = async () => {
    // Messenger/Facebook in-app browsers can't save files: show the
    // screenshot / open-in-browser sheet instead.
    if (inApp) {
      setSaveOpen(true);
      return;
    }
    if (!(await downloadImage(pay.gcash_qr_url, 'gcash-qr'))) setSaveOpen(true);
  };

  const handleCopyLink = async () => {
    setCopied(await copyText(externalBrowserUrl(creditId)));
    setTimeout(() => setCopied(false), 2500);
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
    <section className={styles.panel} aria-label="Pay with GCash" ref={panelRef}>
      <h2 className={styles.title}>Pay with GCash</h2>
      <p className={styles.sub}>
        Remaining balance: <strong>{formatCurrency(balance)}</strong>
      </p>

      {arrived && (
        <div className={styles.arrived} role="status">
          <strong>✅ Your QR code was saved to your device.</strong>
          <span>
            Next: open <b>GCash</b> → <b>Pay QR</b> → <b>Upload QR</b>, choose the saved image and pay.
            Then come back here and send your receipt below.
          </span>
          <span>Didn&apos;t save? Tap <b>Download QR Code</b> below.</span>
        </div>
      )}

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
        {inApp && (
          <p className={styles.hint}>
            Tip: if saving doesn&apos;t work here, tap <b>•••</b> and choose <b>Open in browser</b>.
          </p>
        )}
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

      {saveOpen && (
        <div className={styles.saveOverlay} role="dialog" aria-modal="true" aria-label="Save QR code" onClick={() => setSaveOpen(false)}>
          <div className={styles.saveSheet} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.saveClose} onClick={() => setSaveOpen(false)} aria-label="Close">✕</button>
            <p className={styles.saveTitle}>{inApp ? 'Save the QR Code or Take a Screenshot' : 'Save the QR code'}</p>
            <img src={pay.gcash_qr_url} alt="GCash QR code" className={styles.saveQr} />
            <p className={styles.saveHelp}>
              {inApp ? (
                'Take a screenshot and upload to GCash or Download in browser'
              ) : (
                <>
                  <b>Press and hold</b> the QR code, then tap <b>Save image</b> (or <b>Add to Photos</b>).
                </>
              )}
            </p>
            {inApp && (
              <div className={styles.saveActions}>
                <button type="button" onClick={() => openInExternalBrowser(creditId) || handleCopyLink()}>
                  Open in browser
                </button>
                <button type="button" onClick={handleCopyLink}>
                  {copied ? 'Link copied ✓' : 'Copy link'}
                </button>
              </div>
            )}
            {inApp && (
              <p className={styles.hint}>
                iPhone: tap <b>Copy link</b>, then paste it in Safari — the QR will download there.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
