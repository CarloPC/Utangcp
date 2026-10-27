import { supabase } from '../supabase';

// Same Supabase Storage bucket the app already uses for customer photos.
export const FILE_BUCKET = 'Utangcp';
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB before compression

export function validateImageFile(file) {
  if (!file) return 'Please choose an image.';
  if (!file.type || !file.type.startsWith('image/')) return 'Please choose an image file (JPG or PNG).';
  if (file.size > MAX_INPUT_BYTES) return 'That image is too large (max 10 MB).';
  return null;
}

// Phone screenshots can be several MB. Shrink to <=1280px JPEG before upload.
// Falls back to the original file if anything goes wrong.
export function compressImage(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob && blob.size < file.size ? blob : file), 'image/jpeg', quality);
      } catch {
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export const extFor = (blob) => {
  const t = (blob.type || '').split('/')[1] || 'jpg';
  return t === 'jpeg' ? 'jpg' : t.replace(/[^a-z0-9]/gi, '') || 'jpg';
};

// Uploads to Supabase Storage and returns { url, path }.
export async function uploadPublicFile(path, blob) {
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: blob.type || 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(FILE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function removeStoredFile(path) {
  if (!path) return;
  try {
    await supabase.storage.from(FILE_BUCKET).remove([path]);
  } catch {
    /* orphaned file is not worth failing the UI */
  }
}

export const randomName = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Messenger / Facebook / Instagram etc. open links in an in-app WebView that
// silently ignores "download" links. Detect it so we can offer something that works.
export function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Instagram|Line\/|Snapchat|TikTok|MicroMessenger|Viber/i.test(
    navigator.userAgent || ''
  );
}

const isAndroid = () => /android/i.test(navigator.userAgent || '');

// Android only: ask the system to open this page in the default browser.
// (iPhone can't do this from a web page — the customer uses the ••• menu.)
export function openInExternalBrowser() {
  if (!isAndroid()) return false;
  const u = new URL(window.location.href);
  window.location.href =
    `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
    `#Intent;scheme=${u.protocol.replace(':', '')};action=android.intent.action.VIEW;end`;
  return true;
}

// Native share sheet with the image attached (has "Save Image" / "Save to Photos").
// Returns true if the sheet was shown; false if unsupported or it failed.
export async function shareImageFile(url, baseName = 'gcash-qr') {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return false;
    const blob = await res.blob();
    const file = new File([blob], `${baseName}.${extFor(blob)}`, { type: blob.type || 'image/png' });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: 'GCash QR' });
    return true;
  } catch (err) {
    // User closing the sheet counts as handled; anything else = unsupported
    return err?.name === 'AbortError';
  }
}

/**
 * One-click image download for normal browsers (Chrome, Safari, Firefox...).
 * Returns true when the browser saved the file, false when the caller
 * should show the "press and hold to save" fallback instead.
 */
export async function downloadImage(url, baseName = 'gcash-qr') {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('bad status');
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj;
    a.download = `${baseName}.${extFor(blob)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 2000);
    return true;
  } catch {
    return false;
  }
}
