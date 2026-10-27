import { useEffect, useRef, useState } from 'react';
import { cleanBustParam, hardRefresh, hasUnsavedInput } from '../../utils/hardRefresh';
import styles from './PullToRefresh.module.css';

const THRESHOLD = 80; // px of pull needed to trigger
const MAX_PULL = 130;
const START_SLOP = 8; // ignore tiny movements so taps/clicks still work

// Can the page (and every scroller under the finger/cursor) go no further up?
function atTop(el) {
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollTop > 0) return false;
    }
  }
  return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
}

const BLOCK_ALWAYS = 'input, textarea, select, canvas, [contenteditable="true"], [data-no-ptr]';
const BLOCK_MOUSE = `${BLOCK_ALWAYS}, button, a, img, video, label`;

/**
 * Pull down from the top of ANY page to hard-refresh it.
 *  - touch: drag down with a finger
 *  - desktop: click-and-drag down on an empty area, with the mouse
 * Mounted once in main.jsx, so it covers the owner app, the individual
 * passbook link and the bulk-share link.
 */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const s = useRef({ on: false, mouse: false, x: 0, y: 0, pull: 0, busy: false });

  useEffect(() => {
    cleanBustParam();

    const reset = () => {
      s.current.on = false;
      s.current.pull = 0;
      document.body.style.userSelect = '';
      setPull(0);
    };

    const begin = (x, y, target, mouse) => {
      const st = s.current;
      if (st.busy || !(target instanceof Element)) return;
      if (target.closest(mouse ? BLOCK_MOUSE : BLOCK_ALWAYS)) return;
      if (!atTop(target)) return;
      st.on = true;
      st.mouse = mouse;
      st.x = x;
      st.y = y;
      st.pull = 0;
    };

    // returns true when the event was consumed as a pull
    const move = (x, y, e) => {
      const st = s.current;
      if (!st.on) return;
      const dy = y - st.y;
      const dx = x - st.x;
      if (st.pull === 0 && (dy < 0 || Math.abs(dx) > Math.abs(dy))) {
        // user is scrolling up/sideways, not pulling
        if (Math.abs(dy) > START_SLOP || Math.abs(dx) > START_SLOP) st.on = false;
        return;
      }
      if (dy <= START_SLOP && st.pull === 0) return;
      if (e.cancelable) e.preventDefault(); // stop iOS rubber-band / text selection
      if (st.mouse) document.body.style.userSelect = 'none';
      st.pull = Math.min(MAX_PULL, Math.max(0, (dy - START_SLOP) * 0.55));
      setPull(st.pull);
    };

    const end = async () => {
      const st = s.current;
      if (!st.on) return;
      const triggered = st.pull >= THRESHOLD;
      st.on = false;
      document.body.style.userSelect = '';
      if (!triggered) return reset();

      if (hasUnsavedInput() && !window.confirm('You have information that has not been sent yet. Refresh anyway?')) {
        return reset();
      }
      st.busy = true;
      setRefreshing(true);
      setPull(THRESHOLD);
      await hardRefresh();
    };

    const onTouchStart = (e) => e.touches.length === 1 && begin(e.touches[0].clientX, e.touches[0].clientY, e.target, false);
    const onTouchMove = (e) => e.touches.length === 1 && move(e.touches[0].clientX, e.touches[0].clientY, e);
    const onMouseDown = (e) => e.button === 0 && begin(e.clientX, e.clientY, e.target, true);
    const onMouseMove = (e) => s.current.mouse && move(e.clientX, e.clientY, e);
    const onMouseUp = () => s.current.mouse && end();
    const onTouchEnd = () => !s.current.mouse && end();
    const onTouchCancel = () => reset();

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false }); // needs preventDefault
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  if (pull === 0 && !refreshing) return null;

  const ready = pull >= THRESHOLD;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      className={styles.wrap}
      style={{ transform: `translateY(${pull - 56}px)`, opacity: Math.max(0.25, progress) }}
      role="status"
      aria-live="polite"
    >
      <div className={styles.pill}>
        {refreshing ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <span className={styles.arrow} style={{ transform: `rotate(${ready ? 180 : progress * 160}deg)` }} aria-hidden="true">↓</span>
        )}
        <span>{refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>
    </div>
  );
}
