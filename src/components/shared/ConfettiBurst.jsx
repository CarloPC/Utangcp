import { useEffect, useMemo } from 'react';
import styles from './ConfettiBurst.module.css';

// ── Confetti burst (shared) ──
// Fires a full-screen confetti celebration. Used whenever a customer is
// fully paid off / settled — from the Add Payment form, from picking a
// date in Payment History that has a settled customer, and from Bulk Add.
export default function ConfettiBurst({ onDone, duration = 3200 }) {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [onDone, duration]);

  const pieces = useMemo(() => {
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7', '#ef4444', '#14b8a6'];
    return Array.from({ length: 70 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        id: i,
        left: fromLeft ? Math.random() * 12 : 88 + Math.random() * 12,
        color: colors[i % colors.length],
        delay: Math.random() * 0.7,
        duration: 2.2 + Math.random() * 1.4,
        rotate: Math.round(Math.random() * 360 + 360),
        size: 6 + Math.random() * 6,
        drift: (fromLeft ? 1 : -1) * (60 + Math.random() * 120),
      };
    });
  }, []);

  return (
    <div className={styles.confettiLayer} aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={styles.confettiPiece}
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size * 0.42,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--rot': `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
