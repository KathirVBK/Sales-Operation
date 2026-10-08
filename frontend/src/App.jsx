import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { ChatPanel } from './components/ChatPanel';
import { LeadsBoard } from './components/LeadsBoard';
import { DealsBoard } from './components/DealsBoard';
import { TasksBoard } from './components/TasksBoard';

const DEFAULT_POLL_MS = 5000;

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [globalError, setGlobalError] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [backendHealth, setBackendHealth] = useState(null);

  const showBanner = (message, isError = false) => {
    if (isError) {
      setGlobalError({ message, time: Date.now() });
    } else {
      console.info('[App] Banner:', message);
    }
  };

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setBackendHealth(h);
      if (h.status === 'OK') {
        return true;
      }
      setGlobalError({
        message: `Backend status: ${h.status}. DB: ${h.database}. LLM configured: ${h.llm_configured ? 'yes' : 'no'}.`,
        time: Date.now(),
      });
      return false;
    } catch (err) {
      setBackendHealth({ status: 'UNREACHABLE' });
      setGlobalError({
        message: `Backend unreachable (${err.message || err.status || 'network error'}). Make sure the backend server is running on port 8000.`,
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
        showBanner(err.message || 'Failed to refresh data.', true);
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

  const handleTaskUpdate = async (taskId, newStatus) => {
    try {
      const res = await api.updateTaskStatus(taskId, newStatus);
      if (res && res.status === 'success') {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: newStatus.toUpperCase() } : t,
          ),
        );
        showBanner(
          (res.data && res.data.message) || `Task updated to ${newStatus}.`,
          false,
        );
      }
    } catch (err) {
      showBanner(`Could not update task: ${err.message}`, true);
    }
  };

  const handleDealWon = async (dealId) => {
    try {
      const res = await api.markDealWon(dealId);
      if (res && res.status === 'success') {
        showBanner((res.data && res.data.message) || 'Deal marked as won.', false);
        await fetchAllData({ silent: true });
      }
    } catch (err) {
      showBanner(`Could not mark deal as won: ${err.message}`, true);
    }
  };

  const navItems = [
    { id: 'chat', label: 'Chat Assistant' },
    { id: 'leads', label: 'Leads Pipeline' },
    { id: 'deals', label: 'Won Deals' },
    { id: 'tasks', label: 'Onboarding Tasks' },
  ];

  const dismissError = () => setGlobalError(null);

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-brand">
          <span style={{ color: 'var(--accent-primary)' }}>Lead</span>2Delivery
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => (
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
              {item.label}
            </div>
          ))}
        </nav>

        <div
          style={{
            marginTop: 'auto',
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
              marginBottom: '0.5rem',
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
            <div style={{ opacity: 0.8 }}>v{backendHealth.version}</div>
          )}
        </div>
      </div>

      <div className="main-content">
        <div className="header">
          <span>{navItems.find((i) => i.id === activeTab)?.label}</span>
          {isInitialLoading && (
            <span style={{ marginLeft: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
              Loading…
            </span>
          )}
        </div>

        {globalError && (
          <div
            role="alert"
            style={{
              margin: '0.75rem 1rem 0 1rem',
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
              onClick={dismissError}
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

        <div className="content-area">
          {activeTab === 'chat' && <ChatPanel refreshData={() => fetchAllData({ silent: true })} />}
          {activeTab === 'leads' && <LeadsBoard leads={leads} />}
          {activeTab === 'deals' && (
            <DealsBoard deals={deals} onMarkWon={handleDealWon} />
          )}
          {activeTab === 'tasks' && (
            <TasksBoard tasks={tasks} onUpdateStatus={handleTaskUpdate} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
