import React, { useState, useMemo } from 'react';

const TRANSITIONS = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE', 'BLOCKED'],
  BLOCKED: ['IN_PROGRESS'],
  DONE: [],
};

const STATUS_LABEL = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
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
      <div
        style={{
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: '2rem',
        }}
      >
        No onboarding tasks found. Mark a deal as won to generate tasks.
      </div>
    );
  }

  return (
    <div className="task-board">
      {columns.map((status) => (
        <div key={status} className="task-column">
          <div className="column-header">
            <span>{STATUS_LABEL[status] || status.replace('_', ' ')}</span>
            <span
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                padding: '0.1rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
              }}
            >
              {getTasksByStatus(status).length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {getTasksByStatus(status).map((task) => {
              const nextStatuses = TRANSITIONS[status] || [];
              const isBusy = busyId === task.id;
              const isError = errorId === task.id;
              return (
                <div
                  key={task.id}
                  className="task-card"
                  style={isError ? { border: '1px solid #f87171' } : undefined}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span className={`task-priority priority-${task.priority}`}>
                      {task.priority}
                    </span>
                    {isBusy && (
                      <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Updating…</span>
                    )}
                  </div>

                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                    {task.task_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {task.company_name || 'Unknown company'}
                  </div>

                  {nextStatuses.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.75rem',
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
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          → {STATUS_LABEL[ns] || ns}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TasksBoard;
