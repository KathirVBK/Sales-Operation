import React, { useState } from 'react';
import { LeadCreateForm } from './LeadCreateForm';

function formatCurrency(value) {
  if (value == null || value === '') return 'N/A';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function TierBadge({ tier }) {
  return <span className={`tier-badge tier-${tier}`}>{tier || '—'}</span>;
}

function StatusBadge({ status }) {
  const colorMap = {
    NEW: 'rgba(99,102,241,0.15)',
    QUALIFIED: 'rgba(16,185,129,0.15)',
    CONTACTED: 'rgba(245,158,11,0.15)',
    PROPOSAL: 'rgba(139,92,246,0.15)',
    WON: 'rgba(16,185,129,0.2)',
    LOST: 'rgba(239,68,68,0.15)',
  };
  const textMap = {
    NEW: '#a5b4fc',
    QUALIFIED: '#6ee7b7',
    CONTACTED: '#fcd34d',
    PROPOSAL: '#c4b5fd',
    WON: '#6ee7b7',
    LOST: '#fca5a5',
  };
  const s = (status || 'NEW').toUpperCase();
  return (
    <span
      style={{
        backgroundColor: colorMap[s] || 'rgba(255,255,255,0.1)',
        color: textMap[s] || '#fff',
        padding: '0.2rem 0.65rem',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {s}
    </span>
  );
}

export function LeadsBoard({ leads, onLeadCreated, onConfirmDeal }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmError, setConfirmError] = useState(null);

  const handleConfirmDeal = async (lead) => {
    if (confirmingId) return;
    setConfirmError(null);
    setConfirmingId(lead.id);
    try {
      if (typeof onConfirmDeal === 'function') {
        await onConfirmDeal(lead.id);
      }
      // Close the detail modal after confirming
      setSelectedLead(null);
    } catch (err) {
      setConfirmError(err.message || 'Failed to confirm deal.');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleFormClose = () => setShowCreateForm(false);
  const handleLeadCreated = (result) => {
    if (typeof onLeadCreated === 'function') onLeadCreated(result);
    // Keep form open to show success state inside form
  };

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.3rem' }}>Lead Pipeline</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {leads.length} lead{leads.length !== 1 ? 's' : ''} in pipeline
          </p>
        </div>
        <button
          id="create-lead-btn"
          type="button"
          className="send-btn"
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '0.65rem 1.5rem',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span>
          Create Lead
        </button>
      </div>

      {/* Empty State */}
      {leads.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No leads yet</h3>
          <p style={{ marginBottom: '1.5rem' }}>
            Click <strong>+ Create Lead</strong> to add your first lead to the pipeline.
          </p>
          <button
            type="button"
            className="send-btn"
            onClick={() => setShowCreateForm(true)}
            style={{ padding: '0.65rem 1.75rem' }}
          >
            + Create Lead
          </button>
        </div>
      ) : (
        /* Lead Cards Grid */
        <div className="board-grid">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="card"
              onClick={() => setSelectedLead(lead)}
              style={{ cursor: 'pointer' }}
            >
              {/* Top Row: Company + Tier */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: '0.75rem' }}>
                  <div className="card-title" style={{ marginBottom: '0.2rem' }}>
                    {lead.company_name || 'Unknown Company'}
                  </div>
                  <div className="card-subtitle" style={{ marginBottom: 0 }}>
                    {lead.contact_name ? `Contact: ${lead.contact_name}` : 'No contact info'}
                  </div>
                </div>
                <TierBadge tier={lead.tier} />
              </div>

              {/* Info Rows */}
              <div
                style={{
                  marginTop: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                  fontSize: '0.88rem',
                }}
              >
                {lead.need && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)', minWidth: '90px' }}>Requirement:</span>
                    <span
                      style={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        maxWidth: '180px',
                      }}
                    >
                      {lead.need}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: '90px' }}>Budget:</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(lead.budget)}</span>
                </div>
                {lead.timeline && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)', minWidth: '90px' }}>Timeline:</span>
                    <span style={{ fontWeight: 500 }}>{lead.timeline}</span>
                  </div>
                )}
              </div>

              {/* Score Bar + Status */}
              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    LEAD SCORE
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '80px',
                        height: '6px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${lead.score || 0}%`,
                          height: '100%',
                          background:
                            lead.tier === 'HOT'
                              ? 'linear-gradient(90deg, #ef4444, #f97316)'
                              : lead.tier === 'WARM'
                              ? 'linear-gradient(90deg, #f59e0b, #eab308)'
                              : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                          borderRadius: '999px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {lead.score != null ? `${lead.score}/100` : 'N/A'}
                    </span>
                  </div>
                </div>
                <StatusBadge status={lead.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px' }}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ marginBottom: '0.25rem' }}>{selectedLead.company_name}</h2>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <TierBadge tier={selectedLead.tier} />
                  <StatusBadge status={selectedLead.status} />
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedLead(null)}>
                ×
              </button>
            </div>

            {/* Score Highlight */}
            <div
              style={{
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.2)',
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
                <div className="field-label" style={{ marginBottom: '0.25rem' }}>SCORE</div>
                <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--accent-primary)' }}>
                  {selectedLead.score != null ? `${selectedLead.score}/100` : 'N/A'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="field-label" style={{ marginBottom: '0.25rem' }}>TIER</div>
                <TierBadge tier={selectedLead.tier} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="field-label" style={{ marginBottom: '0.25rem' }}>STATUS</div>
                <StatusBadge status={selectedLead.status} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="field-label" style={{ marginBottom: '0.25rem' }}>BUDGET</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                  {formatCurrency(selectedLead.budget)}
                </div>
              </div>
            </div>

            <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
              <div>
                <div className="field-label">Contact Name</div>
                <div className="field-value">{selectedLead.contact_name || 'N/A'}</div>
              </div>
              <div>
                <div className="field-label">Email</div>
                <div className="field-value">{selectedLead.email || 'N/A'}</div>
              </div>
              <div>
                <div className="field-label">Timeline</div>
                <div className="field-value">{selectedLead.timeline || 'N/A'}</div>
              </div>
              <div>
                <div className="field-label">Created</div>
                <div className="field-value">
                  {selectedLead.created_at
                    ? new Date(selectedLead.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </div>
              </div>
            </div>

            {selectedLead.need && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="field-label">Business Requirement</div>
                <div
                  className="field-value"
                  style={{ fontWeight: 'normal', lineHeight: 1.6 }}
                >
                  {selectedLead.need}
                </div>
              </div>
            )}

            {selectedLead.inquiry && selectedLead.inquiry !== selectedLead.need && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="field-label">Original Inquiry</div>
                <div
                  style={{
                    fontWeight: 'normal',
                    fontStyle: 'italic',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                  }}
                >
                  "{selectedLead.inquiry}"
                </div>
              </div>
            )}

            {/* Outreach Draft */}
            {selectedLead.outreach_subject && (
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '1.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Outreach Draft</h3>
                <div
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    padding: '1.5rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      marginBottom: '0.75rem',
                      paddingBottom: '0.75rem',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <strong>Subject:</strong> {selectedLead.outreach_subject}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.9rem' }}>
                    {selectedLead.outreach_body}
                  </div>
                </div>
              </div>
            )}

            {/* Confirm Deal Button */}
            <div
              style={{
                borderTop: '1px solid var(--border-color)',
                paddingTop: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  background: 'rgba(16,185,129,0.07)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.85rem',
                  color: '#6ee7b7',
                }}
              >
                <strong>Sales process complete?</strong> If the customer has agreed to proceed, click{' '}
                <em>Confirm Deal</em> to convert this lead to a WON deal and trigger the Operations workflow.
              </div>

              {confirmError && (
                <div
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5',
                    fontSize: '0.85rem',
                  }}
                >
                  {confirmError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setSelectedLead(null)}
                  style={{ padding: '0.65rem 1.25rem' }}
                >
                  Close
                </button>
                <button
                  id={`confirm-deal-btn-${selectedLead.id}`}
                  type="button"
                  onClick={() => handleConfirmDeal(selectedLead)}
                  disabled={confirmingId === selectedLead.id}
                  style={{
                    padding: '0.65rem 1.75rem',
                    background:
                      confirmingId === selectedLead.id
                        ? 'rgba(16,185,129,0.4)'
                        : 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: confirmingId === selectedLead.id ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                  }}
                >
                  {confirmingId === selectedLead.id ? 'Confirming…' : '✓ Confirm Deal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Lead Form Modal */}
      {showCreateForm && (
        <LeadCreateForm
          onLeadCreated={handleLeadCreated}
          onClose={handleFormClose}
        />
      )}
    </>
  );
}

export default LeadsBoard;
