import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useCustomers } from './hooks/useCustomers';
import { usePayments } from './hooks/usePayments';

import AuthPage from './components/auth/AuthPage';
import Header from './components/layout/Header';
import NavTabs from './components/layout/NavTabs';
import AddCustomer from './components/tabs/AddCustomer';
import ViewRecords from './components/tabs/ViewRecords';
import Statistics from './components/tabs/Statistics';
import PaymentHistory from './components/tabs/PaymentHistory';
import BulkAdd from './components/tabs/BulkAdd';

import styles from './App.module.css';

export default function App() {
  const { user, logout } = useAuth();
  const {
    customers,
    loading: custLoading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    uploadCustomerPhoto,
    deleteCustomerPhoto,
  } = useCustomers(user?.uid);
  const { payments, loading: payLoading, addPayment, updatePayment, deletePayment } =
    usePayments(user?.uid);

  // Default tab is 'view' (matching daily.php behavior)
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('view');

  // Still resolving auth state
  if (user === undefined) {
    return (
      <div className={styles.fullLoading}>
        <span className={styles.spinner} />
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const isLoading = custLoading || payLoading;

  return (
    <div className={styles.app}>
      <Header user={user} onLogout={logout} isDark={isDark} onToggleTheme={toggleTheme} />
      <NavTabs activeTab={activeTab} onChange={setActiveTab} />

      <main className={styles.main}>
        {isLoading ? (
          <div className={styles.innerLoading}>
            <span className={styles.spinner} />
            <p>Loading your data…</p>
          </div>
        ) : (
          <>
            {activeTab === 'add' && (
              <AddCustomer
                onAdd={addCustomer}
                onAddPayment={addPayment}
                onUploadPhoto={uploadCustomerPhoto}
              />
            )}
            {activeTab === 'view' && (
              <ViewRecords
                customers={customers}
                payments={payments}
                onUpdate={updateCustomer}
                onDelete={deleteCustomer}
                onUploadPhoto={uploadCustomerPhoto}
                onDeletePhoto={deleteCustomerPhoto}
              />
            )}
            {activeTab === 'bulk' && (
              <BulkAdd
                customers={customers}
                onBulkAdd={async (ids, amount) => {
                  // Add a payment for each selected customer using today's date
                  const { today } = await import('./utils/format');
                  for (const id of ids) {
                    // eslint-disable-next-line no-await-in-loop
                    await addPayment(id, amount, today());
                  }
                }}
              />
            )}
            {activeTab === 'stats' && <Statistics customers={customers} />}
            {activeTab === 'payments' && (
              <PaymentHistory
                customers={customers}
                payments={payments}
                onAdd={addPayment}
                onUpdate={updatePayment}
                onDelete={deletePayment}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}