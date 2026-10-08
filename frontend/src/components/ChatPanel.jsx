import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { ExecutionTrace } from './ExecutionTrace';

const WELCOME_MESSAGE = {
  role: 'agent',
  content:
    "Hello! I am the Lead-to-Delivery AI Agent. I can help qualify leads, convert them to deals, and manage onboarding tasks. How can I help you today?",
  system: true,
};

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
      alert(`Failed to clear history: ${err.message}`);
    }
  };

  const handleNewThread = () => {
    if (!window.confirm('Start a new conversation thread? (Current history is preserved in storage.)')) return;
    const newId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem('chat_thread_id', newId);
    } catch (_) {}
    setThreadId(newId);
    setHistoryLoaded(false);
    setMessages([WELCOME_MESSAGE]);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg = trimmed;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await api.sendMessage(userMsg, { threadId });
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

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Thread: <code style={{ opacity: 0.85 }}>{threadId}</code>
          {!historyLoaded && <span style={{ marginLeft: '0.5rem' }}>⟳ Loading…</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleNewThread}
            disabled={isLoading}
            title="Start a new conversation thread"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
          >
            + New Thread
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleClearChat}
            disabled={isLoading}
            title="Clear current chat history"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
          >
            Clear Chat
          </button>
        </div>
      </div>

      <div className="chat-history">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-bubble" style={msg.error ? { border: '1px solid #f87171' } : undefined}>
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
                Agent is thinking…
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-container" onSubmit={handleSend}>
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Enter a new lead, mark a deal as won, or ask about onboarding status… (Shift+Enter for newline)"
          disabled={isLoading}
          rows={Math.min(4, Math.max(1, input.split('\n').length))}
          style={{ resize: 'vertical', minHeight: '2.5rem', lineHeight: '1.4' }}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
