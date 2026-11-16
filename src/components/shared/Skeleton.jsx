import styles from './Skeleton.module.css';

const cx = (...c) => c.filter(Boolean).join(' ');

// A single shimmering block. Pass any of the size classes via `kind`
// ("line" | "lineSm" | "title" | "label" | "input" | "button" | "pill")
// or size it yourself with `style`.
export function SkeletonBlock({ kind, style }) {
  return <span className={cx(styles.skel, kind && styles[kind])} style={style} />;
}

function SkeletonTable({ rows = 6 }) {
  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHead}>
        {Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className={styles.row} key={r}>
          <SkeletonBlock kind="line" style={{ width: `${70 + ((r * 13) % 25)}%` }} />
          <SkeletonBlock kind="line" style={{ width: `${55 + ((r * 17) % 30)}%` }} />
          <SkeletonBlock kind="line" style={{ width: '55%' }} />
          <SkeletonBlock kind="line" style={{ width: '70%' }} />
          <div className={styles.actions}>
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Full-tab skeleton shown while customers/payments are loading.
 *   variant="payments" → heading + add-payment card + search card + table
 *   variant="table"    → heading + table (default, for the other tabs)
 */
export default function TabSkeleton({ variant = 'table' }) {
  return (
    <div className={styles.wrapper} role="status" aria-busy="true" aria-label="Loading your data">
      <SkeletonBlock kind="title" />

      {variant === 'payments' && (
        <>
          <div className={styles.card}>
            <SkeletonBlock kind="line" style={{ width: 140, marginBottom: 18 }} />
            <div className={styles.grid3}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <SkeletonBlock kind="label" />
                  <SkeletonBlock kind="input" />
                </div>
              ))}
            </div>
            <SkeletonBlock kind="button" />
          </div>

          <div className={styles.card}>
            <div className={styles.grid2}>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i}>
                  <SkeletonBlock kind="label" />
                  <SkeletonBlock kind="input" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <SkeletonTable rows={variant === 'payments' ? 5 : 7} />
    </div>
  );
}
