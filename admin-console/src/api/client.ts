import axios from 'axios';

const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Auto-attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aihub_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — skip login endpoint (its 401 means "wrong code/password", not expired token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect on login failures — let the LoginPage show the error
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('aihub_token');
        localStorage.removeItem('aihub_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth API ──
export const authAPI = {
  sendCode: (phone: string) =>
    api.post('/auth/send-code', { phone }),
  loginWithPhone: (phone: string, code: string) =>
    api.post('/auth/login', { phone, code }),
  loginWithPassword: (phone: string, password: string) =>
    api.post('/auth/login', { phone, password }),
  setPassword: (token: string, password: string) =>
    api.post('/auth/set-password', { password }, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  checkInvitation: (code: string) =>
    api.get('/auth/invitation-info', { params: { code } }),
  acceptInvitation: (code: string, phone: string, sms_code: string) =>
    api.post('/auth/accept-invitation', { code, phone, sms_code }),
};

// ── Keys API ──
export const keysAPI = {
  list: () => api.get('/keys'),
  create: (data: {
    name: string; scopes?: string[]; provider_credential_id?: string | null;
    rate_limit_rpm?: number; monthly_budget_cents?: number; daily_budget_cents?: number;
  }) => api.post('/keys', data),
  revoke: (id: string) => api.delete(`/keys/${id}`),
  update: (id: string, data: any) => api.put(`/keys/${id}`, data),
};

// ── Key Bindings API ──
export const bindingsAPI = {
  list: (keyId: string) => api.get(`/keys/${keyId}/bindings`),
  create: (keyId: string, data: {
    provider_credential_id: string; priority?: string; weight?: number;
    allowed_models?: string[] | null; daily_budget_cents?: number; monthly_budget_cents?: number;
  }) => api.post(`/keys/${keyId}/bindings`, data),
  update: (keyId: string, bindingId: string, data: any) => api.put(`/keys/${keyId}/bindings/${bindingId}`, data),
  delete: (keyId: string, bindingId: string) => api.delete(`/keys/${keyId}/bindings/${bindingId}`),
};

// ── Agents API ──
export const agentsAPI = {
  list: () => api.get('/agents'),
  get: (id: string) => api.get(`/agents/${id}`),
  create: (data: { name: string; description?: string; default_model?: string }) =>
    api.post('/agents', data),
  update: (id: string, data: Record<string, any>) => api.patch(`/agents/${id}`, data),
  getCost: (id: string, period?: string) => api.get(`/agents/${id}/cost`, { params: { period } }),
};

// ── Logs API ──
export const logsAPI = {
  query: (params?: Record<string, any>) => api.get('/logs', { params }),
  stats: (params?: Record<string, any>) => api.get('/logs/stats', { params }),
};

// ── Workspaces API ──
export const workspacesAPI = {
  list: () => api.get('/workspaces'),
  create: (name: string, slug: string) => api.post('/workspaces', { name, slug }),
  get: (id: string) => api.get(`/workspaces/${id}`),
  getMembers: (id: string) => api.get(`/workspaces/${id}/members`),
  inviteMember: (id: string, email: string, role: string) => api.post(`/workspaces/${id}/members`, { email, role }),
  removeMember: (id: string, memberId: string) => api.delete(`/workspaces/${id}/members/${memberId}`),
  updateSettings: (id: string, data: any) => api.put(`/workspaces/${id}/settings`, data),
  // Invitation code system (replaces email-based invites)
  createInvitation: (id: string, data?: { role?: string; expires_in_hours?: number; max_uses?: number }) =>
    api.post(`/workspaces/${id}/invitations`, data || {}),
  listInvitations: (id: string) => api.get(`/workspaces/${id}/invitations`),
  revokeInvitation: (id: string, invId: string) => api.delete(`/workspaces/${id}/invitations/${invId}`),
};

// ── Budget API ──
export const budgetAPI = {
  status: () => api.get('/budget/status'),
  alerts: () => api.get('/budget/alerts'),
};

// ── Models API ──
export const modelsAPI = {
  list: (params?: Record<string, any>) => api.get('/models', { params }),
  get: (id: string) => api.get(`/models/${id}`),
  create: (data: any) => api.post('/models', data),
  update: (id: string, data: any) => api.put(`/models/${id}`, data),
  delete: (id: string) => api.delete(`/models/${id}`),
  providers: () => api.get('/models/providers'),
  series: () => api.get('/models/series'),
  rankings: (params?: Record<string, any>) => api.get('/models/rankings', { params }),
  discovery: (params?: Record<string, any>) => api.get('/models/discovery/latest', { params }),
  syncDiscovery: (data?: { model_ids?: string[]; chinese_only?: boolean; mode?: 'new' | 'all'; days?: number }) =>
    api.post('/models/discovery/sync', data),
};
