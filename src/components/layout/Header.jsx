import { useState, useRef, useEffect } from 'react';
import styles from './Header.module.css';

export default function Header({ user, onLogout, isDark, onToggleTheme }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '?';

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className={styles.header}>
      {/* Left – branding */}
      <div className={styles.left}>
        <span className={styles.icon}>💳</span>
        <div>
          <h1 className={styles.title}>Credit Management System</h1>
          <p className={styles.subtitle}>Manage your customers • by Carlo Gwapo</p>
        </div>
      </div>

      {/* Right – user menu */}
      <div className={styles.right} ref={menuRef}>
        <button
          className={styles.avatarBtn}
          onClick={() => setOpen((p) => !p)}
          aria-label="Open user menu"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className={styles.avatar}>{initials}</span>
          <svg
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Dropdown */}
        <div
          className={`${styles.dropdown} ${open ? styles.dropdownOpen : ''}`}
          role="menu"
          aria-label="User menu"
        >
          {/* User info */}
          <div className={styles.dropdownProfile}>
            <span className={styles.dropdownAvatar}>{initials}</span>
            <div className={styles.dropdownUserInfo}>
              <p className={styles.dropdownEmail}>{user?.email}</p>
              <p className={styles.dropdownRole}>Account Owner</p>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Date */}
          <div className={styles.dropdownMeta}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{today}</span>
          </div>

          <div className={styles.divider} />

          {/* Dark mode toggle */}
          <div className={styles.dropdownRow}>
            <div className={styles.rowLeft}>
              <span className={styles.rowIcon} aria-hidden="true">
                {isDark ? '🌙' : '☀️'}
              </span>
              <span className={styles.rowLabel}>Dark Mode</span>
            </div>
            <button
              className={`${styles.toggleSwitch} ${isDark ? styles.toggleOn : ''}`}
              onClick={onToggleTheme}
              role="switch"
              aria-checked={isDark}
              aria-label="Toggle dark mode"
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          <div className={styles.divider} />

          {/* Logout */}
          <button
            className={styles.logoutItem}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-.943a.75.75 0 1 1 1.004-1.114l2.5 2.25a.75.75 0 0 1 0 1.114l-2.5 2.25a.75.75 0 1 1-1.004-1.114l1.048-.943H6.75A.75.75 0 0 1 6 10Z"
                clipRule="evenodd"
              />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
