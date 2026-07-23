import styles from './NavTabs.module.css';

const TABS = [
  { id: 'view', label: 'View Records' },
  { id: 'add', label: 'Add Customer' },
  { id: 'bulk', label: 'Bulk Add' },
  { id: 'stats', label: 'Statistics' },
  { id: 'payments', label: 'Payment History' },
];

export default function NavTabs({ activeTab, onChange }) {
  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onChange(tab.id)}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
