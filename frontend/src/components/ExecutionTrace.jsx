import React from 'react';

export function ExecutionTrace({ trace }) {
  if (!trace || trace.length === 0) return null;

  return (
    <div className="execution-trace">
      <div className="trace-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        Execution Trace
      </div>
      {trace.map((step, idx) => (
        <div key={idx} className="trace-step">
          <span style={{color: 'var(--text-secondary)'}}>✓</span>
          <span className="trace-agent">{step.agent}</span>
          <span className="trace-action" title={step.result}>{step.action}</span>
        </div>
      ))}
    </div>
  );
}
