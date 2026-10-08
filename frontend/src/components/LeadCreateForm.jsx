import React, { useState } from 'react';
import { api } from '../services/api';

const INITIAL_FORM = {
  customer_name: '',
  company_name: '',
  email: '',
  phone: '',
  requirement: '',
  budget: '',
  timeline: '',
  additional_details: '',
};

export function LeadCreateForm({ onLeadCreated, onClose }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.company_name.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!form.requirement.trim()) {
      setError('Customer requirement is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.createLead({
        customer_name: form.customer_name.trim(),
        company_name: form.company_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        requirement: form.requirement.trim(),
        budget: form.budget.trim() || null,
        timeline: form.timeline.trim() || null,
        additional_details: form.additional_details.trim() || null,
      });

      setSuccess(result);
      if (typeof onLeadCreated === 'function') {
        onLeadCreated(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to create lead. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tier = success?.score_result?.tier;
  const score = success?.score_result?.score;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content lead-form-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '720px' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ marginBottom: '0.25rem' }}>Create New Lead</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Enter the customer information received from the sales conversation.
            </p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close" type="button">
            ×
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div style={{ padding: '1rem 0' }}>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '1rem',
                padding: '2rem',
                textAlign: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Lead Qualified!</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                The Sales Agent has qualified and scored this lead.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '2rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>COMPANY</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{form.company_name}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>SCORE</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{score}/100</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>TIER</div>
                  <span className={`tier-badge tier-${tier}`}>{tier}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setSuccess(null);
                  setForm(INITIAL_FORM);
                }}
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Create Another Lead
              </button>
              <button
                type="button"
                className="send-btn"
                onClick={onClose}
                style={{ padding: '0.6rem 1.5rem' }}
              >
                View Lead Pipeline
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit}>
            <div className="form-section-label">Customer Information</div>
            <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="field-label" htmlFor="customer_name">
                  Customer Name <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span>
                </label>
                <input
                  id="customer_name"
                  name="customer_name"
                  type="text"
                  className="form-input"
                  value={form.customer_name}
                  onChange={handleChange}
                  placeholder="e.g. Ravi Kumar"
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="field-label" htmlFor="company_name">
                  Company Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  className="form-input"
                  value={form.company_name}
                  onChange={handleChange}
                  placeholder="e.g. ABC Technologies"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="form-group">
                <label className="field-label" htmlFor="email">
                  Email <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="e.g. ravi@abctech.com"
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="field-label" htmlFor="phone">
                  Phone Number <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  className="form-input"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-section-label">Requirement & Contract Details</div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="field-label" htmlFor="requirement">
                Customer Requirement <span style={{ color: '#f87171' }}>*</span>
              </label>
              <textarea
                id="requirement"
                name="requirement"
                className="form-input"
                value={form.requirement}
                onChange={handleChange}
                placeholder="e.g. Enterprise CRM system with custom workflow automation and 50-user license"
                disabled={isSubmitting}
                rows={3}
                required
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="field-label" htmlFor="budget">
                  Budget <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span>
                </label>
                <input
                  id="budget"
                  name="budget"
                  type="text"
                  className="form-input"
                  value={form.budget}
                  onChange={handleChange}
                  placeholder="e.g. ₹8 lakh or 800000"
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="field-label" htmlFor="timeline">
                  Expected Timeline <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span>
                </label>
                <input
                  id="timeline"
                  name="timeline"
                  type="text"
                  className="form-input"
                  value={form.timeline}
                  onChange={handleChange}
                  placeholder="e.g. 45 days or Q1 2027"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="field-label" htmlFor="additional_details">
                Additional Requirements / Notes{' '}
                <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span>
              </label>
              <textarea
                id="additional_details"
                name="additional_details"
                className="form-input"
                value={form.additional_details}
                onChange={handleChange}
                placeholder="Any additional context, specific features, integrations, or constraints…"
                disabled={isSubmitting}
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                  fontSize: '0.88rem',
                  marginBottom: '1.25rem',
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '1.25rem',
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                onClick={onClose}
                disabled={isSubmitting}
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="send-btn"
                disabled={isSubmitting}
                style={{ padding: '0.6rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isSubmitting ? (
                  <>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    Qualifying Lead…
                  </>
                ) : (
                  'Submit to Sales Agent'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default LeadCreateForm;
