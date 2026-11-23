import { initialsOf } from '../../utils/avatar';
import styles from './Avatar.module.css';

/**
 * Profile picture, or — when there is none — the person's initials
 * (first letter of first name + first letter of last name, e.g. "CC").
 */
export default function Avatar({ url, name, size = 40, className = '', ring = false }) {
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) };
  const cls = `${styles.avatar} ${ring ? styles.ring : ''} ${className}`;
  return url ? (
    <img src={url} alt="" className={`${cls} ${styles.img}`} style={style} draggable={false} />
  ) : (
    <span className={`${cls} ${styles.fallback}`} style={style} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
