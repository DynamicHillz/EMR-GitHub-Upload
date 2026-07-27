export const formatCurrency = (amount: number) => {
  return '₦' + (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const formatDate = (dateString: string | Date) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatBloodGroup = (bg?: string | null) => {
  if (!bg) return '';
  return bg.replace('_POSITIVE', '+').replace('_NEGATIVE', '-');
};
