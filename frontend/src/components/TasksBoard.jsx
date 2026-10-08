import React, { useState, useMemo } from 'react';

const TRANSITIONS = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE', 'BLOCKED'],
  BLOCKED: ['IN_PROGRESS'],
  DONE: [],
};

const STATUS_LABEL = {
  OPEN: 'Pending',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Completed',
};

const STATUS_ICON = {
  OPEN: '',
  IN_PROGRESS: '',
  BLOCKED: '',
  DONE: '',
};

const COLUMN_COLOR = {
  OPEN: 'rgba(99,102,241,0.12)',
  IN_PROGRESS: 'rgba(245,158,11,0.12)',
  BLOCKED: 'rgba(239,68,68,0.12)',
  DONE: 'rgba(16,185,129,0.12)',
};

const TRANSITION_LABEL = {
  IN_PROGRESS: 'Start',
  DONE: 'Complete',
  BLOCKED: 'Block',
};

function formatCurrency(value) {
  if (value == null || value === '') return 'TBD';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'TBD';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function TasksBoard({ tasks, onUpdateStatus }) {
  const [busyId, setBusyId] = useState(null);
  const [errorId, setErrorId] = useState(null);

  const columns = useMemo(() => ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'], []);

  const getTasksByStatus = (status) =>
    Array.isArray(tasks) ? tasks.filter((t) => t.status === status) : [];

  const moveTask = async (task, nextStatus) => {
    if (!task || busyId) return;
    setErrorId(null);
    setBusyId(task.id);
    try {
      if (typeof onUpdateStatus === 'function') {
        await onUpdateStatus(task.id, nextStatus);
      }
    } catch (err) {
      setErrorId(task.id);
      console.error('[TasksBoard] Failed to update task:', err);
    } finally {
      setBusyId((cur) => (cur === task.id ? null : cur));
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4rem' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No operational tasks yet</h3>
        <p style={{ maxWidth: '420px', margin: '0 auto' }}>
          When a Sales Employee confirms a contract from the Lead Pipeline, the Operations Agent will automatically
          generate onboarding tasks and they will appear here.
        </p>
      </div>
    );
  }

  // Summary stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const pendingTasks = tasks.filter((t) => t.status === 'OPEN').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {[
          { label: 'Total Tasks', value: totalTasks, color: 'var(--text-primary)' },
          { label: 'Pending', value: pendingTasks, color: '#a5b4fc' },
          { label: 'In Progress', value: inProgressTasks, color: '#fcd34d' },
          { label: 'Completed', value: doneTasks, color: '#6ee7b7' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.25rem',
              minWidth: '120px',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              {stat.label}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.4rem', color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="task-board" style={{ flex: 1 }}>
        {columns.map((status) => {
          const colTasks = getTasksByStatus(status);
          return (
            <div
              key={status}
              className="task-column"
              style={{
                background: COLUMN_COLOR[status] || 'rgba(15, 17, 21, 0.4)',
              }}
            >
              <div className="column-header">
                <span>
                  {STATUS_LABEL[status] || status.replace('_', ' ')}
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                  }}
                >
                  {colTasks.length}
                </span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {colTasks.map((task) => {
                  const nextStatuses = TRANSITIONS[status] || [];
                  const isBusy = busyId === task.id;
                  const isError = errorId === task.id;
                  return (
                    <div
                      key={task.id}
                      className="task-card"
                      style={
                        isError
                          ? { border: '1px solid #f87171' }
                          : status === 'DONE'
                          ? { opacity: 0.7 }
                          : undefined
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <span className={`task-priority priority-${task.priority}`}>
                          {task.priority}
                        </span>
                        {isBusy && (
                          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Updating…</span>
                        )}
                      </div>

                      <div style={{ fontWeight: 600, marginBottom: '0.3rem', lineHeight: 1.4 }}>
                        {task.task_name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.75rem',
                        }}
                      >
                        {task.company_name || 'Unknown company'}
                      </div>

                      {nextStatuses.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                          }}
                        >
                          {nextStatuses.map((ns) => (
                            <button
                              key={ns}
                              type="button"
                              className="secondary-btn"
                              onClick={() => moveTask(task, ns)}
                              disabled={isBusy}
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                            >
                              {TRANSITION_LABEL[ns] || ns}
                            </button>
                          ))}
                        </div>
                      )}

                      {status === 'DONE' && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#6ee7b7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          Completed
                        </div>
                      )}
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '2rem 1rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      opacity: 0.6,
                    }}
                  >
                    No tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TasksBoard;
