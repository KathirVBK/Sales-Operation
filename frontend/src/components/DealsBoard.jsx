import React, { useState } from 'react';

function formatCurrency(value) {
  if (value == null || value === '') return 'TBD';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'TBD';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function TierBadge({ tier }) {
  if (!tier) return null;
  return <span className={`tier-badge tier-${tier}`}>{tier}</span>;
}

export function DealsBoard({ deals }) {
  const [selectedDeal, setSelectedDeal] = useState(null);

  const wonDeals = Array.isArray(deals) ? deals.filter((d) => d.status === 'WON') : [];
  const otherDeals = Array.isArray(deals) ? deals.filter((d) => d.status !== 'WON') : [];
  const allDeals = [...wonDeals, ...otherDeals];

  if (!deals || deals.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤝</div>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No deals yet</h3>
        <p style={{ maxWidth: '400px', margin: '0 auto' }}>
          When a Sales Employee confirms a deal from the Lead Pipeline, it will appear here with a WON status
          and the Operations Agent will generate onboarding tasks automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'WON Deals', value: wonDeals.length, color: '#10B981' },
          {
            label: 'Total Value',
            value: formatCurrency(wonDeals.reduce((s, d) => s + (Number(d.deal_value) || 0), 0)),
            color: '#6366f1',
          },
          { label: 'All Deals', value: allDeals.length, color: 'var(--text-secondary)' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '0.75rem',
              padding: '1rem 1.5rem',
              minWidth: '140px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              {stat.label}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.4rem', color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Deals Grid */}
      <div className="board-grid">
        {allDeals.map((deal) => {
          const isWon = String(deal.status || '').toUpperCase() === 'WON';
          return (
            <div
              key={deal.id}
              className="card"
              onClick={() => setSelectedDeal(deal)}
              style={{ cursor: 'pointer' }}
            >
              {/* Status strip at top */}
              {isWon && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: '1rem 1rem 0 0',
                  }}
                />
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginTop: isWon ? '0.5rem' : 0,
                }}
              >
                <div>
                  <div className="card-title">{deal.company_name || 'Unknown Company'}</div>
                  <div className="card-subtitle" style={{ marginBottom: 0 }}>
                    {deal.contact_name ? `Contact: ${deal.contact_name}` : `Deal #${deal.id}`}
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: isWon ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)',
                    color: isWon ? '#10B981' : '#3B82F6',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {deal.status || 'OPEN'}
                </span>
              </div>

              <div
                style={{
                  marginTop: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  fontSize: '0.88rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Deal Value:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(deal.deal_value)}</span>
                </div>
                {deal.need && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>Requirement:</span>
                    <span
                      style={{
                        fontWeight: 500,
                        textAlign: 'right',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        maxWidth: '140px',
                      }}
                    >
                      {deal.need}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Lead Score:</span>
                  <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {deal.score != null ? `${deal.score}/100` : 'N/A'}
                    {deal.tier && <TierBadge tier={deal.tier} />}
                  </span>
                </div>
                {isWon && deal.won_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Won At:</span>
                    <span style={{ fontWeight: 500 }}>
                      {new Date(deal.won_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {isWon && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(16,185,129,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.82rem',
                    color: '#6ee7b7',
                  }}
                >
                  <span>✓</span>
                  <span>Deal confirmed · Operations notified</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <div className="modal-overlay" onClick={() => setSelectedDeal(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ marginBottom: '0.5rem' }}>{selectedDeal.company_name}</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span
                    style={{
                      background:
                        selectedDeal.status === 'WON'
                          ? 'rgba(16,185,129,0.2)'
                          : 'rgba(59,130,246,0.2)',
                      color: selectedDeal.status === 'WON' ? '#10B981' : '#3B82F6',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {selectedDeal.status}
                  </span>
                  {selectedDeal.tier && <TierBadge tier={selectedDeal.tier} />}
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedDeal(null)}>
                ×
              </button>
            </div>

            {/* Key metrics */}
            <div
              style={{
                background: 'rgba(16,185,129,0.07)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '0.75rem',
                padding: '1rem 1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div className="field-label">DEAL VALUE</div>
                <div style={{ fontWeight: 700, fontSize: '1.4rem', color: '#10B981' }}>
                  {formatCurrency(selectedDeal.deal_value)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="field-label">LEAD SCORE</div>
                <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>
                  {selectedDeal.score != null ? `${selectedDeal.score}/100` : 'N/A'}
                </div>
              </div>
              {selectedDeal.timeline && (
                <div style={{ textAlign: 'center' }}>
                  <div className="field-label">TIMELINE</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedDeal.timeline}</div>
                </div>
              )}
            </div>

            <div className="grid-2">
              <div>
                <div className="field-label">Contact</div>
                <div className="field-value">{selectedDeal.contact_name || 'N/A'}</div>
              </div>
              <div>
                <div className="field-label">Email</div>
                <div className="field-value">{selectedDeal.email || 'N/A'}</div>
              </div>
              <div>
                <div className="field-label">Deal ID</div>
                <div className="field-value">#{selectedDeal.id}</div>
              </div>
              <div>
                <div className="field-label">Won At</div>
                <div className="field-value">
                  {selectedDeal.won_at
                    ? new Date(selectedDeal.won_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </div>
              </div>
            </div>

            {selectedDeal.need && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className="field-label">Requirement</div>
                <div className="field-value" style={{ fontWeight: 'normal' }}>
                  {selectedDeal.need}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelectedDeal(null)}
                style={{ padding: '0.6rem 1.5rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DealsBoard;
