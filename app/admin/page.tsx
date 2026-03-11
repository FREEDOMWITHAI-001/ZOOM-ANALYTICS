'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Client {
  client_name: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  meeting_count: number;
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

type ModalMode = 'create' | 'edit' | null;

const defaultForm = { client_name: '', password: '', role: 'user', is_active: true };

export default function AdminPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'activity'>('overview');

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

  const openCreate = () => {
    setForm(defaultForm);
    setFormError('');
    setShowPassword(false);
    setModalMode('create');
    setEditingClient(null);
  };

  const openEdit = (client: Client) => {
    setForm({ client_name: client.client_name, password: '', role: client.role, is_active: client.is_active });
    setFormError('');
    setShowPassword(false);
    setModalMode('edit');
    setEditingClient(client);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingClient(null);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      if (modalMode === 'create') {
        if (!form.client_name.trim() || !form.password) {
          setFormError('Name and password are required');
          return;
        }
        const res = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_name: form.client_name.trim(), password: form.password, role: form.role }),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || 'Failed to create'); return; }
      } else if (modalMode === 'edit' && editingClient) {
        const payload: Record<string, any> = { role: form.role, is_active: form.is_active };
        if (form.password) payload.password = form.password;
        const res = await fetch(`/api/admin/clients/${encodeURIComponent(editingClient.client_name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || 'Failed to update'); return; }
      }

      closeModal();
      fetchData();
    } finally {
      setFormLoading(false);
    }
  };

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
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              ← Back to App
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {(['overview', 'clients', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-6">System Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Clients" value={stats.total_clients} color="blue" icon="👥" />
              <StatCard label="Active Clients" value={stats.active_clients} color="green" icon="✅" />
              <StatCard label="Total Meetings" value={stats.total_meetings} color="purple" icon="🎥" />
              <StatCard label="Total Participants" value={stats.total_participants ?? '—'} color="orange" icon="👤" />
              <StatCard label="Avg Retention" value={stats.avg_retention ? `${stats.avg_retention}%` : '—'} color="teal" icon="📊" />
              <StatCard label="Avg Engagement" value={stats.avg_engagement_score ? `${stats.avg_engagement_score}/100` : '—'} color="pink" icon="⚡" />
              <StatCard label="Clients w/ Data" value={stats.clients_with_data} color="indigo" icon="📁" />
              <StatCard label="Admin Accounts" value={stats.admin_count} color="red" icon="🛡️" />
            </div>
          </div>
        )}

        {/* Clients Tab */}
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
                    <th className="px-4 py-3 text-gray-400 font-medium">Created</th>
                    <th className="px-4 py-3 text-gray-400 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No clients found
                      </td>
                    </tr>
                  ) : (
                    clients.map((c) => (
                      <tr key={c.client_name} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-white">{c.client_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.role === 'admin'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-700 text-gray-300'
                          }`}>
                            {c.role || 'user'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(c)}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-70 ${
                              c.is_active
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {c.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{c.meeting_count}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
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

        {/* Activity Tab */}
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
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No activity yet
                      </td>
                    </tr>
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
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(a.generated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">
                {modalMode === 'create' ? 'Create New Client' : `Edit: ${editingClient?.client_name}`}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {modalMode === 'create' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Client Name</label>
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    placeholder="e.g. acme_corp"
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
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

              {formError && (
                <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {formLoading ? 'Saving...' : modalMode === 'create' ? 'Create Client' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
            <p className="text-xs text-red-400 text-center mb-6">
              This will permanently delete all their meeting data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/20',
    green: 'bg-green-500/10 border-green-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
    orange: 'bg-orange-500/10 border-orange-500/20',
    teal: 'bg-teal-500/10 border-teal-500/20',
    pink: 'bg-pink-500/10 border-pink-500/20',
    indigo: 'bg-indigo-500/10 border-indigo-500/20',
    red: 'bg-red-500/10 border-red-500/20',
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
