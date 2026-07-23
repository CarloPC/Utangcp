export const formatCurrency = (amount) =>
  `₱${Number(amount || 0).toLocaleString('en-PH')}`;

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  // Add time to prevent timezone-shift issues
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

export const today = () => new Date().toISOString().split('T')[0];
