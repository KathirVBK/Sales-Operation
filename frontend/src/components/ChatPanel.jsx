import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { ExecutionTrace } from './ExecutionTrace';

const WELCOME_MESSAGE = {
  role: 'agent',
  content:
    "Hello! I'm your Sales & Operations AI Assistant. I can help you retrieve business information.\n\nYou can ask me:\n• \"Show me all HOT leads\"\n• \"Why was ABC Technologies classified as a HOT lead?\"\n• \"Which leads have a score above 80?\"\n• \"What deals are currently WON?\"\n• \"Show me pending high-priority tasks\"\n• \"What is the status of ABC Technologies?\"\n\nTo create a lead, use the Lead Pipeline → + Create Lead button.\nTo confirm a deal, open a lead and click Confirm Deal.",
  system: true,
};

const QUICK_PROMPTS = [
  'Show me all HOT leads',
  'Which leads have a score above 70?',
  'What deals are WON?',
  'Show pending high-priority tasks',
];

function formatMessagesFromHistory(historyItems = []) {
  const out = [];
  for (const item of historyItems) {
    const role = item.role === 'user' ? 'user' : 'agent';
    const msg = {
      role,
      content: item.content || '',
    };
    if (item.intent) msg.intent = item.intent;
    if (item.trace_json) {
      try {
        msg.trace = JSON.parse(item.trace_json);
      } catch (_) {}
    }
    out.push(msg);
  }
  return out;
}

export function ChatPanel({ refreshData }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [threadId, setThreadId] = useState(() => api.getThreadId());
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const loadHistory = useCallback(async (tid) => {
    try {
      const res = await api.getChatHistory({ threadId: tid });
      const formatted = formatMessagesFromHistory(res.messages || []);
      if (formatted.length > 0) {
        setMessages([WELCOME_MESSAGE, ...formatted]);
      } else {
        setMessages([WELCOME_MESSAGE]);
      }
    } catch (err) {
      console.warn('[ChatPanel] Failed to load chat history:', err.message);
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadHistory(threadId);
  }, [threadId, loadHistory]);

  const handleClearChat = async () => {
    if (!window.confirm('Clear chat history for this thread?')) return;
    try {
      await api.clearChatHistory({ threadId });
      setMessages([WELCOME_MESSAGE]);
    } catch (err) {
      console.error('[ChatPanel] Failed to clear history:', err);
    }
  };

  const handleNewThread = () => {
    if (!window.confirm('Start a new conversation thread?')) return;
    const newId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem('chat_thread_id', newId);
    } catch (_) {}
    setThreadId(newId);
    setHistoryLoaded(false);
    setMessages([WELCOME_MESSAGE]);
  };

  const sendMessage = async (messageText) => {
    const trimmed = (messageText || input).trim();
    if (!trimmed || isLoading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setIsLoading(true);

    try {
      const response = await api.sendMessage(trimmed, { threadId });
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content: response.response || '(empty response)',
          trace: response.execution_trace,
          intent: response.intent,
        },
      ]);
      try {
        if (typeof refreshData === 'function') {
          await Promise.resolve(refreshData());
        }
      } catch (_) {}
    } catch (err) {
      const detail = err.message || 'Unknown error';
      console.error('[ChatPanel] Send error:', detail);
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content: `⚠️ Error: ${detail}`,
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    await sendMessage();
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '0.375rem',
              padding: '0.2rem 0.6rem',
              fontSize: '0.75rem',
              color: 'var(--accent-primary)',
              fontWeight: 600,
            }}
          >
            🔍 Query Mode
          </span>
          <span style={{ marginLeft: '0.75rem', opacity: 0.7 }}>
            Thread: <code>{threadId.slice(0, 20)}…</code>
          </span>
          {!historyLoaded && <span style={{ marginLeft: '0.5rem' }}>⟳ Loading…</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleNewThread}
            disabled={isLoading}
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
          >
            + New Thread
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleClearChat}
            disabled={isLoading}
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Message History */}
      <div className="chat-history">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div
              className="message-bubble"
              style={msg.error ? { border: '1px solid #f87171' } : undefined}
            >
              {typeof msg.content === 'string'
                ? msg.content.split('\n').map((line, idx) => (
                    <React.Fragment key={idx}>
                      {line}
                      {idx < msg.content.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))
                : msg.content}
            </div>
            {msg.trace && msg.trace.length > 0 && <ExecutionTrace trace={msg.trace} />}
            {msg.intent && (
              <div
                style={{
                  marginTop: '0.25rem',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  paddingLeft: '0.25rem',
                }}
              >
                Intent: {msg.intent}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message agent">
            <div className="message-bubble" style={{ opacity: 0.7 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                Searching database…
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div
        style={{
          padding: '0.75rem 1rem 0',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.1)',
        }}
      >
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="secondary-btn"
            onClick={() => sendMessage(prompt)}
            disabled={isLoading}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '9999px',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form className="chat-input-container" onSubmit={handleSend}>
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Ask about leads, deals, tasks… (e.g. Show me all HOT leads)"
          disabled={isLoading}
          rows={Math.min(3, Math.max(1, input.split('\n').length))}
          style={{ resize: 'vertical', minHeight: '2.5rem', lineHeight: '1.4' }}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 'Searching…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
