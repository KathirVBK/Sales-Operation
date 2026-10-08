const API_URL = 'http://127.0.0.1:8000/api';

const DEFAULT_THREAD_ID = 'default_thread';

function getThreadId() {
  try {
    const stored = localStorage.getItem('chat_thread_id');
    if (stored && typeof stored === 'string' && stored.trim()) {
      return stored.trim();
    }
  } catch (_) {}
  const generated = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    localStorage.setItem('chat_thread_id', generated);
  } catch (_) {}
  return generated;
}

async function _handleResponse(res) {
  if (!res.ok) {
    let detail = null;
    try {
      const body = await res.json();
      detail = body.detail || body.message || body.error || JSON.stringify(body);
    } catch (_) {
      try {
        detail = await res.text();
      } catch (_) {
        detail = `HTTP ${res.status}`;
      }
    }
    const err = new Error(detail || `Request failed with HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  getThreadId,

  // Chat (query-only)
  async sendMessage(message, { threadId } = {}) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Message is required.');
    }
    const tid = threadId || getThreadId();
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim(), thread_id: tid }),
    });
    return _handleResponse(res);
  },

  async getChatHistory({ threadId, limit = 50 } = {}) {
    const tid = encodeURIComponent(threadId || getThreadId());
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 50;
    const res = await fetch(`${API_URL}/chat/history?thread_id=${tid}&limit=${safeLimit}`);
    return _handleResponse(res);
  },

  async clearChatHistory({ threadId } = {}) {
    const tid = encodeURIComponent(threadId || getThreadId());
    const res = await fetch(`${API_URL}/chat/history?thread_id=${tid}`, {
      method: 'DELETE',
    });
    return _handleResponse(res);
  },

  // Health
  async health() {
    const res = await fetch(`${API_URL}/health`);
    return _handleResponse(res);
  },

  // Leads
  async getLeads() {
    const res = await fetch(`${API_URL}/leads`);
    return _handleResponse(res);
  },

  async getLead(id) {
    if (!id) throw new Error('Lead id is required.');
    const res = await fetch(`${API_URL}/leads/${encodeURIComponent(id)}`);
    return _handleResponse(res);
  },

  /**
   * Create a lead via the structured Lead Creation Form.
   * @param {Object} formData - { customer_name, company_name, email, phone, requirement, budget, timeline, additional_details }
   */
  async createLead(formData) {
    if (!formData || !formData.company_name || !formData.requirement) {
      throw new Error('Company name and requirement are required.');
    }
    const res = await fetch(`${API_URL}/leads/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    return _handleResponse(res);
  },

  /**
   * Human-controlled deal confirmation. Sales Employee confirms customer accepted deal.
   * @param {number} leadId - The ID of the qualified lead to convert to a WON deal
   */
  async confirmDeal(leadId) {
    if (!leadId) throw new Error('Lead id is required.');
    const res = await fetch(`${API_URL}/leads/${encodeURIComponent(leadId)}/confirm-deal`, {
      method: 'POST',
    });
    return _handleResponse(res);
  },

  // Deals
  async getDeals() {
    const res = await fetch(`${API_URL}/deals`);
    return _handleResponse(res);
  },

  async getDeal(id) {
    if (!id) throw new Error('Deal id is required.');
    const res = await fetch(`${API_URL}/deals/${encodeURIComponent(id)}`);
    return _handleResponse(res);
  },

  async getDealStatus(dealId) {
    if (!dealId) throw new Error('Deal id is required.');
    const res = await fetch(`${API_URL}/deals/${encodeURIComponent(dealId)}/status`);
    return _handleResponse(res);
  },

  // Tasks
  async getTasks() {
    const res = await fetch(`${API_URL}/tasks`);
    return _handleResponse(res);
  },

  async updateTaskStatus(taskId, status) {
    if (!taskId) throw new Error('Task id is required.');
    if (!status || typeof status !== 'string') {
      throw new Error('Status must be a non-empty string.');
    }
    const normalized = String(status).trim().toUpperCase();
    const allowed = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'PENDING', 'COMPLETED'];
    if (!allowed.includes(normalized)) {
      throw new Error(`Invalid status: ${normalized}.`);
    }
    const res = await fetch(`${API_URL}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: normalized }),
    });
    return _handleResponse(res);
  },
};

export default api;
