import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { ChatPanel } from './components/ChatPanel';
import { LeadsBoard } from './components/LeadsBoard';
import { DealsBoard } from './components/DealsBoard';
import { TasksBoard } from './components/TasksBoard';

const DEFAULT_POLL_MS = 5000;

const NAV_ITEMS = [
  { id: 'leads', label: 'Lead Pipeline', icon: '📋', section: 'Sales' },
  { id: 'deals', label: 'Won Deals', icon: '🤝', section: 'Sales' },
  { id: 'tasks', label: 'Ops Tasks', icon: '⚙️', section: 'Operations' },
  { id: 'chat', label: 'AI Assistant', icon: '🔍', section: 'AI' },
];

function groupNavItems(items) {
  const groups = {};
  items.forEach((item) => {
    if (!groups[item.section]) groups[item.section] = [];
    groups[item.section].push(item);
  });
  return groups;
}

function App() {
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [globalError, setGlobalError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [backendHealth, setBackendHealth] = useState(null);

  const showError = (message) => {
    setGlobalError({ message, time: Date.now() });
  };

  const showSuccess = (message) => {
    setSuccessBanner({ message, time: Date.now() });
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setBackendHealth(h);
      if (h.status === 'OK') return true;
      setGlobalError({
        message: `Backend status: ${h.status}. DB: ${h.database}. LLM configured: ${h.llm_configured ? 'yes' : 'no'}.`,
        time: Date.now(),
      });
      return false;
    } catch (err) {
      setBackendHealth({ status: 'UNREACHABLE' });
      setGlobalError({
        message: `Backend unreachable (${err.message || 'network error'}). Make sure the backend server is running on port 8000.`,
        time: Date.now(),
      });
      return false;
    }
  }, []);

  const fetchAllData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    try {
      const healthy = await checkHealth();
      if (!healthy) {
        setIsInitialLoading(false);
        return;
      }
      const [leadsData, dealsData, tasksData] = await Promise.all([
        api.getLeads(),
        api.getDeals(),
        api.getTasks(),
      ]);
      setLeads(Array.isArray(leadsData.leads) ? leadsData.leads : []);
      setDeals(Array.isArray(dealsData.deals) ? dealsData.deals : []);
      setTasks(Array.isArray(tasksData.tasks) ? tasksData.tasks : []);
      setGlobalError(null);
    } catch (err) {
      if (!silent) {
        console.error('[App] Failed to fetch data:', err);
        showError(err.message || 'Failed to refresh data.');
      }
    } finally {
      setIsInitialLoading(false);
    }
  }, [checkHealth]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => fetchAllData({ silent: true }), DEFAULT_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // ── Task update ─────────────────────────────────────────────────────────────
  const handleTaskUpdate = async (taskId, newStatus) => {
    try {
      const res = await api.updateTaskStatus(taskId, newStatus);
      if (res && res.status === 'success') {
        // Map friendly status to DB status
        const canonicalStatus =
          newStatus.toUpperCase() === 'COMPLETED'
            ? 'DONE'
            : newStatus.toUpperCase() === 'PENDING'
            ? 'OPEN'
            : newStatus.toUpperCase();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: canonicalStatus } : t)),
        );
        showSuccess((res.data && res.data.message) || `Task updated to ${newStatus}.`);
      }
    } catch (err) {
      showError(`Could not update task: ${err.message}`);
    }
  };

  // ── Deal confirmation (human-controlled) ────────────────────────────────────
  const handleConfirmDeal = async (leadId) => {
    try {
      const res = await api.confirmDeal(leadId);
      if (res && res.status === 'success') {
        const d = res.data;
        showSuccess(
          d?.message ||
            `Deal confirmed for ${d?.company_name || 'company'}. ${d?.tasks_count || 0} onboarding tasks created.`,
        );
        await fetchAllData({ silent: true });
      }
    } catch (err) {
      throw err; // Let LeadsBoard handle the error display
    }
  };

  // ── Lead created callback ────────────────────────────────────────────────────
  const handleLeadCreated = async (result) => {
    showSuccess(
      `Lead qualified! ${result?.lead?.company_name || 'Lead'} scored ${result?.score_result?.score || '?'}/100 — Tier: ${result?.score_result?.tier || '?'}`,
    );
    await fetchAllData({ silent: true });
  };

  const navGroups = groupNavItems(NAV_ITEMS);
  const activeItem = NAV_ITEMS.find((i) => i.id === activeTab);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-brand">
          <span>Lead</span>2Delivery
        </div>

        <nav style={{ flex: 1 }}>
          {Object.entries(navGroups).map(([section, items]) => (
            <div key={section} style={{ marginBottom: '0.5rem' }}>
              <div
                style={{
                  padding: '0.75rem 2rem 0.35rem',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  opacity: 0.6,
                }}
              >
                {section}
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setActiveTab(item.id);
                  }}
                >
                  <span style={{ marginRight: '0.6rem' }}>{item.icon}</span>
                  {item.label}
                  {item.id === 'leads' && leads.length > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        background: 'rgba(99,102,241,0.2)',
                        color: 'var(--accent-primary)',
                        borderRadius: '9999px',
                        padding: '0.05rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {leads.length}
                    </span>
                  )}
                  {item.id === 'tasks' && tasks.filter((t) => t.status === 'OPEN').length > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        background: 'rgba(245,158,11,0.2)',
                        color: '#fcd34d',
                        borderRadius: '9999px',
                        padding: '0.05rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {tasks.filter((t) => t.status === 'OPEN').length}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Backend Status */}
        <div
          style={{
            padding: '1.25rem',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.4rem',
            }}
          >
            <span>Backend</span>
            <span
              style={{
                color:
                  backendHealth?.status === 'OK'
                    ? '#10B981'
                    : backendHealth?.status === 'DEGRADED'
                    ? '#F59E0B'
                    : backendHealth?.status === 'UNREACHABLE'
                    ? '#EF4444'
                    : 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              {backendHealth?.status || 'Checking…'}
            </span>
          </div>
          {backendHealth?.version && (
            <div style={{ opacity: 0.7 }}>v{backendHealth.version}</div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="header">
          <span>
            {activeItem?.icon && (
              <span style={{ marginRight: '0.5rem' }}>{activeItem.icon}</span>
            )}
            {activeItem?.label}
          </span>
          {isInitialLoading && (
            <span style={{ marginLeft: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
              Loading…
            </span>
          )}
        </div>

        {/* Error Banner */}
        {globalError && (
          <div
            role="alert"
            style={{
              margin: '0.75rem 1rem 0',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fecaca',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>{globalError.message}</div>
            <button
              onClick={() => setGlobalError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontSize: '1.1rem',
                cursor: 'pointer',
                lineHeight: 1,
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Success Banner */}
        {successBanner && (
          <div
            style={{
              margin: '0.75rem 1rem 0',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.4)',
              color: '#6ee7b7',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>✓ {successBanner.message}</div>
            <button
              onClick={() => setSuccessBanner(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontSize: '1.1rem',
                cursor: 'pointer',
                lineHeight: 1,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <div className="content-area">
          {activeTab === 'leads' && (
            <LeadsBoard
              leads={leads}
              onLeadCreated={handleLeadCreated}
              onConfirmDeal={handleConfirmDeal}
            />
          )}
          {activeTab === 'deals' && <DealsBoard deals={deals} />}
          {activeTab === 'tasks' && (
            <TasksBoard tasks={tasks} onUpdateStatus={handleTaskUpdate} />
          )}
          {activeTab === 'chat' && <ChatPanel refreshData={() => fetchAllData({ silent: true })} />}
        </div>
      </div>
    </div>
  );
}

export default App;
