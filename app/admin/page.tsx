'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  client_name: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  meeting_count: number;
  // Integration fields
  zoom_account_id: string | null;
  zoom_client_id: string | null;
  zoom_client_secret: string | null;
  zoom_webhook_secret: string | null;
  ghl_token: string | null;
  ghl_location_id: string | null;
  db_client_name: string | null;
  n8n_webhook_id: string | null;
  ai_provider: string | null;
  ai_api_key: string | null;
}

interface Stats {
  total_clients: string;
  active_clients: string;
  admin_count: string;
  total_meetings: string;
  clients_with_data: string;
  avg_retention: string | null;
  avg_engagement_score: string | null;
  total_participants: string | null;
}

interface RecentActivity {
  meeting_id: string;
  meeting_name: string;
  client_name: string;
  generated_at: string;
  total_unique_participants: number;
  average_retention: number;
}

interface IntegrationForm {
  zoomAccountId: string;
  zoomClientId: string;
  zoomClientSecret: string;
  zoomWebhookSecret: string;
  ghlToken: string;
  ghlLocationId: string;
  dbClientName: string;
  aiProvider: string;
  aiApiKey: string;
}

interface FormState {
  client_name: string;
  password: string;
  role: string;
  is_active: boolean;
  integration: IntegrationForm;
}

type ModalMode = 'create' | 'edit' | null;
type ActiveTab = 'overview' | 'clients' | 'activity' | 'workflow' | 'prompts';

interface PromptMeta {
  label: string;
  description: string;
  variables: string[];
}


// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultIntegration: IntegrationForm = {
  zoomAccountId: '',
  zoomClientId: '',
  zoomClientSecret: '',
  zoomWebhookSecret: '',
  ghlToken: '',
  ghlLocationId: '',
  dbClientName: '',
  aiProvider: 'openai',
  aiApiKey: '',
};

const defaultForm: FormState = {
  client_name: '',
  password: '',
  role: 'user',
  is_active: true,
  integration: { ...defaultIntegration },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasWorkflowData(c: Pick<Client, 'zoom_account_id' | 'zoom_client_id' | 'zoom_client_secret' | 'zoom_webhook_secret' | 'ghl_token' | 'ghl_location_id'>): boolean {
  return !!(c.zoom_account_id && c.zoom_client_id && c.zoom_client_secret && c.zoom_webhook_secret && c.ghl_token && c.ghl_location_id);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showZoomSecret, setShowZoomSecret] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [workflowContent, setWorkflowContent] = useState('');
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowError, setWorkflowError] = useState('');
  const [workflowSaved, setWorkflowSaved] = useState(false);
  const [aiTestState, setAiTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [aiTestError, setAiTestError] = useState('');

  // Prompts state
  const [promptValues, setPromptValues] = useState<Record<string, string>>({});
  const [promptDefaults, setPromptDefaults] = useState<Record<string, string>>({});
  const [promptMeta, setPromptMeta] = useState<Record<string, PromptMeta>>({});
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptsError, setPromptsError] = useState('');
  const [promptsSaved, setPromptsSaved] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  // After-create state
  const [createdClient, setCreatedClient] = useState<{ name: string; hasWorkflow: boolean } | null>(null);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);

  // Collapsible sections in modal
  const [zoomSectionOpen, setZoomSectionOpen] = useState(true);
  const [ghlSectionOpen, setGhlSectionOpen] = useState(true);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clientsRes, statsRes] = await Promise.all([
        fetch('/api/admin/clients'),
        fetch('/api/admin/stats'),
      ]);

      if (clientsRes.status === 403 || statsRes.status === 403) {
        router.replace('/login');
        return;
      }

      const clientsData = await clientsRes.json();
      const statsData = await statsRes.json();

      if (clientsData.success) setClients(clientsData.clients);
      if (statsData.success) {
        setStats(statsData.stats);
        setRecentActivity(statsData.recent_activity);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(defaultForm);
    setFormError('');
    setShowPassword(false);
    setShowZoomSecret(false);
    setZoomSectionOpen(true);
    setGhlSectionOpen(true);
    setModalMode('create');
    setEditingClient(null);
    setCreatedClient(null);
    setAiTestState('idle');
    setAiTestError('');
  };

  const openEdit = (client: Client) => {
    setForm({
      client_name: client.client_name,
      password: '',
      role: client.role,
      is_active: client.is_active,
      integration: {
        zoomAccountId: client.zoom_account_id ?? '',
        zoomClientId: client.zoom_client_id ?? '',
        zoomClientSecret: client.zoom_client_secret ?? '',
        zoomWebhookSecret: client.zoom_webhook_secret ?? '',
        ghlToken: client.ghl_token ?? '',
        ghlLocationId: client.ghl_location_id ?? '',
        dbClientName: client.db_client_name ?? client.client_name,
        aiProvider: client.ai_provider ?? 'openai',
        aiApiKey: client.ai_api_key ?? '',
      },
    });
    setFormError('');
    setShowPassword(false);
    setShowZoomSecret(false);
    setZoomSectionOpen(true);
    setGhlSectionOpen(true);
    setModalMode('edit');
    setEditingClient(client);
    setCreatedClient(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingClient(null);
    setFormError('');
    setCreatedClient(null);
    setAiTestState('idle');
    setAiTestError('');
  };

  // Auto-fill dbClientName from client_name when creating
  const handleClientNameChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      client_name: value,
      integration: {
        ...prev.integration,
        dbClientName: prev.integration.dbClientName === '' ||
          prev.integration.dbClientName === prev.client_name
          ? value
          : prev.integration.dbClientName,
      },
    }));
  };

  // ── Form submit ────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    const integrationPayload = {
      zoomAccountId: form.integration.zoomAccountId || undefined,
      zoomClientId: form.integration.zoomClientId || undefined,
      zoomClientSecret: form.integration.zoomClientSecret || undefined,
      zoomWebhookSecret: form.integration.zoomWebhookSecret || undefined,
      ghlToken: form.integration.ghlToken || undefined,
      ghlLocationId: form.integration.ghlLocationId || undefined,
      dbClientName: form.integration.dbClientName || undefined,
      aiProvider: form.integration.aiProvider || undefined,
      aiApiKey: form.integration.aiApiKey || undefined,
    };

    try {
      if (modalMode === 'create') {
        if (!form.client_name.trim() || !form.password) {
          setFormError('Name and password are required');
          return;
        }
        const res = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: form.client_name.trim(),
            password: form.password,
            role: form.role,
            ...integrationPayload,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || 'Failed to create'); return; }

        setCreatedClient({ name: data.client_name, hasWorkflow: data.has_workflow_data });
        fetchData();
        // Don't close modal — show success state instead
      } else if (modalMode === 'edit' && editingClient) {
        const payload: Record<string, any> = {
          role: form.role,
          is_active: form.is_active,
          ...integrationPayload,
        };
        if (form.password) payload.password = form.password;
        const res = await fetch(`/api/admin/clients/${encodeURIComponent(editingClient.client_name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || 'Failed to update'); return; }
        closeModal();
        fetchData();
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ── Download workflow ──────────────────────────────────────────────────────

  const downloadWorkflow = (clientName: string) => {
    window.open(
      `/api/admin/clients/${encodeURIComponent(clientName)}/download-workflow`,
      '_blank'
    );
  };

  // ── Delete / toggle ────────────────────────────────────────────────────────

  const handleDelete = async (name: string) => {
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Delete failed'); return; }
      setDeleteConfirm(null);
      fetchData();
    } catch {
      alert('Delete failed');
    }
  };

  const handleToggleActive = async (client: Client) => {
    try {
      await fetch(`/api/admin/clients/${encodeURIComponent(client.client_name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !client.is_active }),
      });
      fetchData();
    } catch {
      alert('Update failed');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  const handleImpersonate = async (clientName: string) => {
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: clientName }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Impersonation failed');
        return;
      }
      // Navigate to the user's view (session cookie is now set to their account)
      router.push('/');
    } catch {
      alert('Impersonation failed');
    }
  };

  // ── Workflow template ──────────────────────────────────────────────────────

  const loadWorkflow = async () => {
    setWorkflowLoading(true);
    setWorkflowError('');
    try {
      const res = await fetch('/api/admin/workflow-template');
      const data = await res.json();
      if (!res.ok) { setWorkflowError(data.error || 'Failed to load'); return; }
      setWorkflowContent(data.content);
    } catch {
      setWorkflowError('Failed to load workflow');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const saveWorkflow = async () => {
    setWorkflowSaving(true);
    setWorkflowError('');
    setWorkflowSaved(false);
    try {
      // Validate JSON client-side first
      JSON.parse(workflowContent);
      const res = await fetch('/api/admin/workflow-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: workflowContent }),
      });
      const data = await res.json();
      if (!res.ok) { setWorkflowError(data.error || 'Failed to save'); return; }
      setWorkflowSaved(true);
      setTimeout(() => setWorkflowSaved(false), 3000);
    } catch (e: any) {
      setWorkflowError(e instanceof SyntaxError ? 'Invalid JSON: ' + e.message : 'Failed to save');
    } finally {
      setWorkflowSaving(false);
    }
  };

  const testAiKey = async () => {
    const { aiProvider, aiApiKey } = form.integration;
    if (!aiApiKey.trim()) { setAiTestError('Enter an API key first'); setAiTestState('fail'); return; }
    setAiTestState('testing');
    setAiTestError('');
    try {
      const res = await fetch('/api/admin/test-ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey }),
      });
      const data = await res.json();
      if (data.valid) {
        setAiTestState('ok');
      } else {
        setAiTestState('fail');
        setAiTestError(data.error || 'Key rejected by provider');
      }
    } catch {
      setAiTestState('fail');
      setAiTestError('Network error');
    }
  };

  // ── Prompts ────────────────────────────────────────────────────────────────

  const loadPrompts = async () => {
    setPromptsLoading(true);
    setPromptsError('');
    try {
      const res = await fetch('/api/admin/prompts');
      const data = await res.json();
      if (!res.ok) { setPromptsError(data.error || 'Failed to load prompts'); return; }
      setPromptValues(data.prompts);
      setPromptDefaults(data.defaults);
      setPromptMeta(data.meta);
    } catch {
      setPromptsError('Failed to load prompts');
    } finally {
      setPromptsLoading(false);
    }
  };

  const savePrompts = async () => {
    setPromptsSaving(true);
    setPromptsError('');
    setPromptsSaved(false);
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: promptValues }),
      });
      const data = await res.json();
      if (!res.ok) { setPromptsError(data.error || 'Failed to save'); return; }
      setPromptsSaved(true);
      setTimeout(() => setPromptsSaved(false), 3000);
    } catch {
      setPromptsError('Failed to save prompts');
    } finally {
      setPromptsSaving(false);
    }
  };

  const resetPrompt = (key: string) => {
    if (promptDefaults[key]) {
      setPromptValues(prev => ({ ...prev, [key]: promptDefaults[key] }));
      setPromptsSaved(false);
    }
  };

  const resetAllPrompts = () => {
    setPromptValues({ ...promptDefaults });
    setPromptsSaved(false);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'workflow' && !workflowContent) loadWorkflow();
    if (tab === 'prompts' && Object.keys(promptValues).length === 0) loadPrompts();
  };

  // ── Render guards ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
              <p className="text-xs text-gray-400">Zoom Analytics</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {(['overview', 'clients', 'activity', 'workflow', 'prompts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Overview Tab ───────────────────────────────────────────────── */}
        {activeTab === 'overview' && stats && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-6">System Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Clients"    value={stats.total_clients}                                  color="blue"   icon="👥" />
              <StatCard label="Active Clients"   value={stats.active_clients}                                 color="green"  icon="✅" />
              <StatCard label="Total Meetings"   value={stats.total_meetings}                                 color="purple" icon="🎥" />
              <StatCard label="Total Participants" value={stats.total_participants ?? '—'}                    color="orange" icon="👤" />
              <StatCard label="Avg Retention"    value={stats.avg_retention ? `${stats.avg_retention}%` : '—'} color="teal"   icon="📊" />
              <StatCard label="Avg Engagement"   value={stats.avg_engagement_score ? `${stats.avg_engagement_score}/100` : '—'} color="pink" icon="⚡" />
              <StatCard label="Clients w/ Data"  value={stats.clients_with_data}                              color="indigo" icon="📁" />
              <StatCard label="Admin Accounts"   value={stats.admin_count}                                    color="red"    icon="🛡️" />
            </div>
          </div>
        )}

        {/* ── Clients Tab ────────────────────────────────────────────────── */}
        {activeTab === 'clients' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Client Accounts</h2>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <span>+ New Client</span>
              </button>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="px-4 py-3 text-gray-400 font-medium">Client Name</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Role</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Status</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Meetings</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">n8n</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Created</th>
                    <th className="px-4 py-3 text-gray-400 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No clients found</td>
                    </tr>
                  ) : (
                    clients.map((c) => (
                      <tr key={c.client_name} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-white">{c.client_name}</span>
                          {c.db_client_name && c.db_client_name !== c.client_name && (
                            <span className="ml-2 text-xs text-gray-500 font-mono">db:{c.db_client_name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'
                          }`}>
                            {c.role || 'user'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(c)}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-70 ${
                              c.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {c.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{c.meeting_count}</td>
                        <td className="px-4 py-3">
                          {hasWorkflowData(c) ? (
                            <button
                              onClick={() => downloadWorkflow(c.client_name)}
                              title="Download n8n Workflow"
                              className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                            >
                              <DownloadIcon className="w-3.5 h-3.5" />
                              <span>Workflow</span>
                            </button>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {c.role !== 'admin' && (
                              <button
                                onClick={() => handleImpersonate(c.client_name)}
                                title="View as this user"
                                className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                              >
                                View as
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(c)}
                              className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(c.client_name)}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Activity Tab ───────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-6">Recent Meeting Activity</h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="px-4 py-3 text-gray-400 font-medium">Meeting</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Client</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Participants</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Retention</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Analyzed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No activity yet</td></tr>
                  ) : (
                    recentActivity.map((a, i) => (
                      <tr key={i} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white truncate max-w-xs">{a.meeting_name || a.meeting_id}</p>
                          <p className="text-xs text-gray-500 font-mono">{a.meeting_id}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{a.client_name}</td>
                        <td className="px-4 py-3 text-gray-300">{a.total_unique_participants ?? '—'}</td>
                        <td className="px-4 py-3">
                          {a.average_retention != null ? (
                            <span className={`text-sm font-medium ${
                              a.average_retention >= 70 ? 'text-green-400' :
                              a.average_retention >= 40 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {Number(a.average_retention).toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{new Date(a.generated_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ── Workflow Tab ───────────────────────────────────────────────── */}
        {activeTab === 'workflow' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">n8n Workflow Template</h2>
                <p className="text-xs text-gray-500 mt-1">Edit the base workflow JSON used to generate client workflows. Changes take effect on the next download.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadWorkflow}
                  disabled={workflowLoading}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {workflowLoading ? 'Loading...' : 'Reload'}
                </button>
                <button
                  onClick={saveWorkflow}
                  disabled={workflowSaving || workflowLoading || !workflowContent}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {workflowSaving ? 'Saving...' : workflowSaved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>

            {workflowError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {workflowError}
              </div>
            )}

            {workflowSaved && (
              <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
                Workflow template saved successfully.
              </div>
            )}

            {workflowLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <textarea
                value={workflowContent}
                onChange={(e) => { setWorkflowContent(e.target.value); setWorkflowError(''); setWorkflowSaved(false); }}
                spellCheck={false}
                className="w-full h-[600px] bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono focus:outline-none focus:border-blue-500 resize-y"
                placeholder="Loading workflow JSON..."
              />
            )}
          </div>
        )}

        {/* ── Prompts Tab ────────────────────────────────────────────────── */}
        {activeTab === 'prompts' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">AI Prompts</h2>
                <p className="text-xs text-gray-500 mt-1">Edit the prompts used for AI transcript analysis. Use template variables (shown below each prompt) that get replaced at runtime.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={resetAllPrompts}
                  disabled={promptsLoading}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Reset All to Defaults
                </button>
                <button
                  onClick={loadPrompts}
                  disabled={promptsLoading}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {promptsLoading ? 'Loading...' : 'Reload'}
                </button>
                <button
                  onClick={savePrompts}
                  disabled={promptsSaving || promptsLoading || Object.keys(promptValues).length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {promptsSaving ? 'Saving...' : promptsSaved ? 'Saved!' : 'Save All'}
                </button>
              </div>
            </div>

            {promptsError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {promptsError}
              </div>
            )}

            {promptsSaved && (
              <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
                Prompts saved successfully.
              </div>
            )}

            {promptsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(promptMeta).map(([key, meta]) => {
                  const isExpanded = expandedPrompt === key;
                  const isModified = promptValues[key] !== promptDefaults[key];
                  return (
                    <div key={key} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                      {/* Prompt header */}
                      <button
                        type="button"
                        onClick={() => setExpandedPrompt(isExpanded ? null : key)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                              {meta.label}
                              {isModified && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400 rounded">Modified</span>
                              )}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                          </div>
                        </div>
                        <ChevronIcon open={isExpanded} className="shrink-0 ml-4" />
                      </button>

                      {/* Expanded editor */}
                      {isExpanded && (
                        <div className="px-5 pb-5 space-y-3 border-t border-gray-800">
                          {/* Variable chips */}
                          <div className="flex flex-wrap items-center gap-2 pt-3">
                            <span className="text-xs text-gray-500">Variables:</span>
                            {meta.variables.map((v) => (
                              <span
                                key={v}
                                className="px-2 py-0.5 text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded"
                              >
                                {v}
                              </span>
                            ))}
                          </div>

                          {/* Textarea */}
                          <textarea
                            value={promptValues[key] || ''}
                            onChange={(e) => {
                              setPromptValues(prev => ({ ...prev, [key]: e.target.value }));
                              setPromptsSaved(false);
                            }}
                            spellCheck={false}
                            rows={16}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 font-mono focus:outline-none focus:border-blue-500 resize-y leading-relaxed"
                          />

                          {/* Per-prompt actions */}
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-600">
                              {promptValues[key]?.length || 0} characters
                            </div>
                            <button
                              type="button"
                              onClick={() => resetPrompt(key)}
                              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                            >
                              Reset to Default
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl shadow-2xl my-8">

            {/* Modal header */}
            <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {modalMode === 'create' ? 'Create New Client' : `Edit: ${editingClient?.client_name}`}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Success state after creation ───────────────────────────── */}
            {createdClient ? (
              <div className="px-6 py-6 space-y-5">
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="w-9 h-9 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-300">Client created successfully!</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="font-mono text-white">{createdClient.name}</span> is ready to use.
                    </p>
                  </div>
                </div>

                {createdClient.hasWorkflow && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-300">Download their pre-configured n8n workflow:</p>
                    <button
                      onClick={() => downloadWorkflow(createdClient.name)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors w-full justify-center"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      Download n8n Workflow
                    </button>

                    {/* Setup Instructions */}
                    <div className="border border-gray-700 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowSetupInstructions(!showSetupInstructions)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        <span>📋 Setup Instructions</span>
                        <ChevronIcon open={showSetupInstructions} />
                      </button>
                      {showSetupInstructions && (
                        <div className="px-4 pb-4 space-y-4 text-xs text-gray-400 border-t border-gray-700 pt-3">
                          <SetupStep num={1} title="Zoom Marketplace">
                            <p>Create a Server-to-Server OAuth app (if not done).</p>
                            <p className="mt-1">Register webhook URL:</p>
                            <code className="block bg-gray-800 rounded px-2 py-1 mt-1 text-gray-300 break-all">
                              https://YOUR_N8N_DOMAIN/webhook/zoom-analytics-support
                            </code>
                            <p className="mt-2">Add these event subscriptions:</p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-500">
                              <li>meeting.ended</li>
                              <li>webinar.ended</li>
                              <li>meeting.participant_left</li>
                              <li>webinar.participant_left</li>
                              <li>recording.transcript_completed</li>
                              <li>endpoint.url_validation</li>
                            </ul>
                          </SetupStep>

                          <SetupStep num={2} title="Import & configure in n8n">
                            <p>Import the downloaded JSON file into n8n.</p>
                            <p className="mt-1">Create one <span className="text-white">HTTP Basic Auth</span> credential:</p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-500">
                              <li>Name: <span className="text-gray-300 font-mono">{createdClient.name} Zoom OAuth</span></li>
                              <li>Username: their Zoom Client ID</li>
                              <li>Password: their Zoom Client Secret</li>
                            </ul>
                            <p className="mt-1">Open the workflow → <span className="text-white">Get zoom auth token6</span> node → assign this credential.</p>
                          </SetupStep>

                          <SetupStep num={3} title="Postgres credential">
                            <p>Create one <span className="text-white">Postgres</span> credential connected to the shared DB.</p>
                            <p className="mt-1">Assign it to both <span className="text-white">Execute a SQL query</span> nodes in the workflow.</p>
                          </SetupStep>

                          <SetupStep num={4} title="Activate">
                            <p>Toggle the workflow to <span className="text-green-400 font-medium">Active</span> in n8n.</p>
                            <p className="mt-1 text-gray-500">All other values (GHL token, DB name, Zoom bearer, webhook secret) are already hardcoded in the workflow.</p>
                          </SetupStep>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => { setCreatedClient(null); }}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Create Another
                  </button>
                </div>
              </div>
            ) : (
              /* ── Create / Edit Form ──────────────────────────────────── */
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">

                {/* SECTION 1 — Account */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</h4>

                  {modalMode === 'create' && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Client Name</label>
                      <input
                        type="text"
                        value={form.client_name}
                        onChange={(e) => handleClientNameChange(e.target.value)}
                        placeholder="e.g. AcmeCorp"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">
                      {modalMode === 'edit' ? 'New Password (leave blank to keep current)' : 'Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder={modalMode === 'edit' ? '••••••••' : 'Min 6 characters'}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 pr-10"
                        required={modalMode === 'create'}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                        <EyeIcon show={showPassword} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Role</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {modalMode === 'edit' && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, is_active: !form.is_active })}
                        className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-blue-600' : 'bg-gray-600'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                      <span className="text-sm text-gray-300">{form.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-800" />

                {/* SECTION 2 — Zoom */}
                <CollapsibleSection
                  title="Zoom Server-to-Server OAuth App"
                  subtitle="Create a Server-to-Server OAuth app at marketplace.zoom.us"
                  open={zoomSectionOpen}
                  onToggle={() => setZoomSectionOpen(!zoomSectionOpen)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Account ID" placeholder="p_wBPLDtRpqr2ke75ukXgQ" value={form.integration.zoomAccountId}
                      onChange={(v) => setForm(f => ({ ...f, integration: { ...f.integration, zoomAccountId: v } }))} />
                    <FormField label="Client ID" placeholder="ePp5uClySrmHVSVJUIY9Qg" value={form.integration.zoomClientId}
                      onChange={(v) => setForm(f => ({ ...f, integration: { ...f.integration, zoomClientId: v } }))} />
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Client Secret</label>
                      <div className="relative">
                        <input
                          type={showZoomSecret ? 'text' : 'password'}
                          value={form.integration.zoomClientSecret}
                          onChange={(e) => setForm(f => ({ ...f, integration: { ...f.integration, zoomClientSecret: e.target.value } }))}
                          placeholder="••••••••••••••••"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 pr-10"
                        />
                        <button type="button" onClick={() => setShowZoomSecret(!showZoomSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                          <EyeIcon show={showZoomSecret} />
                        </button>
                      </div>
                    </div>
                    <FormField label="Webhook Secret Token" placeholder="8HcNDvSjTFCFxhFkzxBMYw" value={form.integration.zoomWebhookSecret}
                      onChange={(v) => setForm(f => ({ ...f, integration: { ...f.integration, zoomWebhookSecret: v } }))} />
                  </div>
                </CollapsibleSection>

                <div className="border-t border-gray-800" />

                {/* SECTION 3 — GHL */}
                <CollapsibleSection
                  title="GoHighLevel (GHL) API"
                  subtitle="Find these in your GHL sub-account settings"
                  open={ghlSectionOpen}
                  onToggle={() => setGhlSectionOpen(!ghlSectionOpen)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <FormField label="API Token" placeholder="Bearer pit-..." value={form.integration.ghlToken}
                        onChange={(v) => setForm(f => ({ ...f, integration: { ...f.integration, ghlToken: v } }))} />
                    </div>
                    <FormField label="Location ID" placeholder="c5pmhaUCKw488A7LdZDr" value={form.integration.ghlLocationId}
                      onChange={(v) => setForm(f => ({ ...f, integration: { ...f.integration, ghlLocationId: v } }))} />
                  </div>
                </CollapsibleSection>

                <div className="border-t border-gray-800" />

                {/* SECTION 4 — DB Mapping */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Database Mapping</h4>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">DB Client Name</label>
                    <input
                      type="text"
                      value={form.integration.dbClientName}
                      onChange={(e) => setForm(f => ({ ...f, integration: { ...f.integration, dbClientName: e.target.value } }))}
                      placeholder={form.client_name || 'Same as Client Name'}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-600 mt-1">This must match what n8n writes to the <code className="text-gray-500">client_name</code> column in the database.</p>
                  </div>
                </div>

                <div className="border-t border-gray-800" />

                {/* SECTION 5 — AI Provider */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Provider</h4>
                  <p className="text-xs text-gray-600">Used for transcript analysis in-app and in the n8n workflow. Key is embedded in the downloaded workflow JSON — no separate n8n credential needed.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
                      <select
                        value={form.integration.aiProvider}
                        onChange={(e) => { setForm(f => ({ ...f, integration: { ...f.integration, aiProvider: e.target.value } })); setAiTestState('idle'); setAiTestError(''); }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="openai">OpenAI (GPT-4o mini)</option>
                        <option value="gemini">Google Gemini (1.5 Flash)</option>
                        <option value="anthropic">Anthropic (Claude Haiku)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">API Key</label>
                      <input
                        type="password"
                        value={form.integration.aiApiKey}
                        onChange={(e) => { setForm(f => ({ ...f, integration: { ...f.integration, aiApiKey: e.target.value } })); setAiTestState('idle'); setAiTestError(''); }}
                        placeholder="sk-... / AIza... / sk-ant-..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={testAiKey}
                      disabled={aiTestState === 'testing' || !form.integration.aiApiKey.trim()}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {aiTestState === 'testing' ? 'Testing...' : 'Test Key'}
                    </button>
                    {aiTestState === 'ok' && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Key is valid
                      </span>
                    )}
                    {aiTestState === 'fail' && (
                      <span className="text-xs text-red-400">{aiTestError || 'Invalid key'}</span>
                    )}
                  </div>
                </div>

                {formError && (
                  <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{formError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal}
                    className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={formLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                    {formLoading ? 'Saving...' : modalMode === 'create' ? 'Create Client' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm shadow-2xl p-6">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white text-center mb-2">Delete Client</h3>
            <p className="text-sm text-gray-400 text-center mb-1">
              Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm}</span>?
            </p>
            <p className="text-xs text-red-400 text-center mb-6">This will permanently delete all their meeting data.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-500/10 border-blue-500/20',
    green:  'bg-green-500/10 border-green-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
    orange: 'bg-orange-500/10 border-orange-500/20',
    teal:   'bg-teal-500/10 border-teal-500/20',
    pink:   'bg-pink-500/10 border-pink-500/20',
    indigo: 'bg-indigo-500/10 border-indigo-500/20',
    red:    'bg-red-500/10 border-red-500/20',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || 'bg-gray-800 border-gray-700'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function CollapsibleSection({
  title, subtitle, open, onToggle, children,
}: {
  title: string; subtitle: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <button type="button" onClick={onToggle} className="w-full flex items-start justify-between text-left group">
        <div>
          <h4 className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <ChevronIcon open={open} className="mt-0.5 shrink-0 ml-2" />
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

function FormField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
      />
    </div>
  );
}

function SetupStep({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{num}</div>
      <div>
        <p className="text-gray-300 font-medium text-xs mb-1">{title}</p>
        <div className="text-gray-500 text-xs space-y-1">{children}</div>
      </div>
    </div>
  );
}

function ChevronIcon({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
