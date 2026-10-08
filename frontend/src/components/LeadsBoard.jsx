import React, { useState } from 'react';

export function LeadsBoard({ leads }) {
  const [selectedLead, setSelectedLead] = useState(null);

  if (!leads || leads.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>No leads found. Enter a lead in the chat to get started.</div>;
  }

  return (
    <>
      <div className="board-grid">
        {leads.map(lead => (
          <div key={lead.id} className="card" onClick={() => setSelectedLead(lead)} style={{cursor: 'pointer'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <div className="card-title">{lead.company_name || 'Unknown Company'}</div>
                <div className="card-subtitle">{lead.contact_name || 'No contact'}</div>
              </div>
              <span className={`tier-badge tier-${lead.tier}`}>{lead.tier}</span>
            </div>
            
            <div style={{marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.9rem'}}>
              <div>
                <span style={{color: 'var(--text-secondary)'}}>Score: </span>
                <span style={{fontWeight: '600'}}>{lead.score}/100</span>
              </div>
              <div>
                <span style={{color: 'var(--text-secondary)'}}>Status: </span>
                <span style={{fontWeight: '600'}}>{lead.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedLead.company_name}</h2>
              <button className="close-btn" onClick={() => setSelectedLead(null)}>×</button>
            </div>
            
            <div className="grid-2">
              <div>
                <div className="field-label">Contact Name</div>
                <div className="field-value">{selectedLead.contact_name || 'N/A'}</div>
              </div>
              <div>
                <div className="field-label">Email</div>
                <div className="field-value">{selectedLead.email || 'N/A'}</div>
              </div>
              <div>
                <div className="field-label">Budget</div>
                <div className="field-value">{selectedLead.budget ? `₹${selectedLead.budget}` : 'N/A'}</div>
              </div>
              <div>
                <div className="field-label">Timeline</div>
                <div className="field-value">{selectedLead.timeline || 'N/A'}</div>
              </div>
            </div>

            <div style={{marginTop: '1.5rem'}}>
              <div className="field-label">Business Need</div>
              <div className="field-value" style={{fontWeight: 'normal'}}>{selectedLead.need || 'N/A'}</div>
            </div>

            <div style={{marginTop: '1.5rem'}}>
              <div className="field-label">Original Inquiry</div>
              <div className="field-value" style={{fontWeight: 'normal', fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem'}}>
                "{selectedLead.inquiry}"
              </div>
            </div>

            <div style={{marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem'}}>
              <h3>Outreach Draft</h3>
              <div style={{marginTop: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '0.5rem'}}>
                <div style={{marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)'}}>
                  <strong>Subject:</strong> {selectedLead.outreach_subject || 'No subject'}
                </div>
                <div style={{whiteSpace: 'pre-wrap'}}>
                  {selectedLead.outreach_body || 'No draft generated'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
