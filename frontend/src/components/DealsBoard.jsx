import React, { useState } from 'react';

function formatCurrency(value) {
  if (value == null || value === '') return 'TBD';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'TBD';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function DealsBoard({ deals, onMarkWon }) {
  const [busyId, setBusyId] = useState(null);
  const [errorId, setErrorId] = useState(null);

  const handleMarkWon = async (deal) => {
    if (!deal || busyId) return;
    setErrorId(null);
    setBusyId(deal.id);
    try {
      if (typeof onMarkWon === 'function') {
        await onMarkWon(deal.id);
      }
    } catch (err) {
      setErrorId(deal.id);
      console.error('[DealsBoard] Failed to mark deal as won:', err);
    } finally {
      setBusyId((cur) => (cur === deal.id ? null : cur));
    }
  };

  if (!deals || deals.length === 0) {
    return (
      <div
        style={{
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: '2rem',
        }}
      >
        No deals found. Mark a lead as won via the chat to create a deal.
      </div>
    );
  }

  return (
    <div className="board-grid">
      {deals.map((deal) => {
        const isWon = String(deal.status || '').toUpperCase() === 'WON';
        const isBusy = busyId === deal.id;
        const isError = errorId === deal.id;
        return (
          <div
            key={deal.id}
            className="card"
            style={isError ? { border: '1px solid #f87171' } : undefined}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}
            >
              <div>
                <div className="card-title">{deal.company_name || 'Unknown Company'}</div>
                <div className="card-subtitle">Deal #{deal.id}</div>
              </div>
              <span
                style={{
                  backgroundColor: isWon
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(59, 130, 246, 0.2)',
                  color: isWon ? '#10B981' : '#3B82F6',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {deal.status || 'OPEN'}
              </span>
            </div>

            <div
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Value:</span>
                <span style={{ fontWeight: 500 }}>{formatCurrency(deal.deal_value)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Lead Score:</span>
                <span style={{ fontWeight: 500 }}>
                  {deal.score != null ? `${deal.score} (${deal.tier || '-'})` : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Won At:</span>
                <span style={{ fontWeight: 500 }}>
                  {deal.won_at ? new Date(deal.won_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            {!isWon && (
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="send-btn"
                  onClick={() => handleMarkWon(deal)}
                  disabled={isBusy}
                  style={{ width: '100%' }}
                >
                  {isBusy ? 'Processing…' : 'Mark as Won'}
                </button>
                {isError && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      fontSize: '0.78rem',
                      color: '#fca5a5',
                    }}
                  >
                    Failed to mark deal as won.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DealsBoard;
