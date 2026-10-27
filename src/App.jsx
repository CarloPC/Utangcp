import { useEffect, useRef, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useCustomers } from './hooks/useCustomers';
import { usePayments } from './hooks/usePayments';
import { useSharedPassbooks } from './hooks/useSharedPassbooks';
import { usePublicPassbook } from './hooks/usePublicPassbook';
import { useSharedGroups } from './hooks/useSharedGroups';
import { usePublicGroup } from './hooks/usePublicGroup';
import { usePaymentSettings } from './hooks/usePaymentSettings';
import { usePaymentSubmissions } from './hooks/usePaymentSubmissions';
import { getShareIdFromUrl, getGroupIdFromUrl } from './utils/passbook';

import AuthPage from './components/auth/AuthPage';
import Header from './components/layout/Header';
import NavTabs from './components/layout/NavTabs';
import OfflineBanner from './components/shared/OfflineBanner';
import CustomerPassbookModal from './components/shared/CustomerPassbookModal';
import CustomerGroupView from './components/shared/CustomerGroupView';
import InstallPopup from './components/shared/InstallPopup';
import AddCustomer from './components/tabs/AddCustomer';
import ViewRecords from './components/tabs/ViewRecords';
import Statistics from './components/tabs/Statistics';
import PaymentHistory from './components/tabs/PaymentHistory';
import GcashPayments from './components/tabs/GcashPayments';
import BulkAdd from './components/tabs/BulkAdd';

import styles from './App.module.css';

export default function App() {
  const { user, logout } = useAuth();

  // Public passbook link (?share=<token>). Read once on first render.
  // When present, this tab is a guest view: no login, no private data.
  const [shareId] = useState(getShareIdFromUrl);
  const [groupId] = useState(getGroupIdFromUrl); // ?group=<token> (bulk list)
  const isShareView = Boolean(shareId || groupId);
  const publicPassbook = usePublicPassbook(shareId);
  const publicGroup = usePublicGroup(groupId);
  const ownerUid = isShareView ? undefined : user?.uid;

  const {
    customers,
    loading: custLoading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    uploadCustomerPhoto,
    deleteCustomerPhoto,
  } = useCustomers(ownerUid);
  const { payments, loading: payLoading, addPayment, updatePayment, deletePayment, logInitialPayment } =
    usePayments(ownerUid);

  const paymentSettings = usePaymentSettings(ownerUid);
  const submissions = usePaymentSubmissions(ownerUid, addPayment);

  const { createShareLink, revokeShare } = useSharedPassbooks(
    ownerUid,
    customers,
    payments,
    !custLoading && !payLoading && !paymentSettings.loading,
    paymentSettings.payInfo
  );
  const { groups, createGroupLink, revokeGroup } = useSharedGroups(
    ownerUid,
    customers,
    payments,
    !custLoading && !payLoading
  );

  // Default tab is 'view' (matching daily.php behavior)
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('view');

  // Controls the install popup — opened automatically ~1.2s after a
  // genuinely fresh login, via the Header's "Install App" row.
  //
  // Because Firebase persists the session, a page REFRESH also makes
  // `user` go from undefined -> the same logged-in object, which looks
  // identical to a fresh login from this component's perspective. To
  // tell them apart, we mark "already shown" in sessionStorage the
  // first time it displays. sessionStorage survives refreshes (so it
  // won't show again on reload) but is cleared on explicit logout (so
  // the next real login shows it again). Closing the tab also clears
  // sessionStorage, so a brand new tab session counts as fresh too.
  const [showInstallModal, setShowInstallModal] = useState(false);
  const prevUserRef = useRef(undefined);

  useEffect(() => {
    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    if (!prevUser && user) {
      if (!sessionStorage.getItem('installPopupShown')) {
        sessionStorage.setItem('installPopupShown', '1');
        const timer = setTimeout(() => setShowInstallModal(true), 1200);
        return () => clearTimeout(timer);
      }
    }

    if (!user) {
      sessionStorage.removeItem('installPopupShown');
    }
  }, [user]);

  // Public passbook: render BEFORE the auth gates so guests never see AuthPage.
  if (groupId) {
    return (
      <>
        <OfflineBanner />
        <CustomerGroupView
          group={publicGroup.data}
          loading={publicGroup.loading}
          error={publicGroup.error}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      </>
    );
  }

  if (shareId) {
    return (
      <>
        <OfflineBanner />
        <CustomerPassbookModal
          passbook={publicPassbook.data}
          shareId={shareId}
          loading={publicPassbook.loading}
          error={publicPassbook.error}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      </>
    );
  }

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
    return (
      <>
        <OfflineBanner />
        <AuthPage />
      </>
    );
  }

  const isLoading = custLoading || payLoading;

  return (
    <div className={styles.app}>
      <OfflineBanner />
      <Header
        user={user}
        onLogout={logout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenInstall={() => setShowInstallModal(true)}
      />

      {/* On desktop (>1340px) this renders in normal flow, right where your
          original top nav sat. On mobile (<=1340px) NavTabs.module.css
          switches it to position: fixed, bottom: 0 via media query — DOM
          position stops mattering at that point, but keeping it here is
          what makes the desktop layout correct. */}
      <NavTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        badges={{ payments: submissions.pending.length }}
      />

      <main className={`${styles.main} ${styles.mainWithBottomNav}`}>
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
                onLogInitialPayment={logInitialPayment}
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
                onShare={createShareLink}
                onUnshare={revokeShare}
                groups={groups}
                onBulkShare={createGroupLink}
                onRevokeGroup={revokeGroup}
              />
            )}
            {activeTab === 'bulk' && (
              <BulkAdd
                customers={customers}
                payments={payments}
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
              <>
                <GcashPayments
                  settings={paymentSettings.settings}
                  onSaveSettings={paymentSettings.saveSettings}
                  onRemoveQr={paymentSettings.removeQr}
                  pending={submissions.pending}
                  reviewed={submissions.reviewed}
                  onApprove={submissions.approve}
                  onReject={submissions.reject}
                  onRemove={submissions.remove}
                />
                <PaymentHistory
                  customers={customers}
                  payments={payments}
                  onAdd={addPayment}
                  onUpdate={updatePayment}
                  onDelete={deletePayment}
                />
              </>
            )}
          </>
        )}
      </main>

      <InstallPopup open={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
}