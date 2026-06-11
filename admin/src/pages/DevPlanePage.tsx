import { useEffect, useState } from 'react';
import { getIssues, getStates, getMembers, createIssue, type PlaneIssue, type PlaneState, type PlaneMember } from '../lib/planeApi';

export default function DevPlanePage() {
  const [issues, setIssues] = useState<PlaneIssue[]>([]);
  const [stateMap, setStateMap] = useState<Map<string, PlaneState>>(new Map());
  const [memberMap, setMemberMap] = useState<Map<string, PlaneMember>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<PlaneIssue['priority']>('medium');
  const [creating, setCreating] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [issueData, stateData, memberData] = await Promise.all([getIssues(), getStates(), getMembers()]);
      setIssues(issueData);
      setStateMap(new Map(stateData.map((s) => [s.id, s])));
      setMemberMap(new Map(memberData.map((m) => [m.id, m])));
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await createIssue({ name: newTitle.trim(), priority: newPriority });
      setNewTitle('');
      setShowCreate(false);
      await loadData();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create issue');
    } finally {
      setCreating(false);
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high':   return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'low':    return 'bg-slate-100 text-slate-600';
      default:       return 'bg-slate-100 text-slate-400';
    }
  };

  const groupBg = (group: PlaneState['group']) => {
    switch (group) {
      case 'completed':  return 'bg-emerald-50';
      case 'started':    return 'bg-blue-50';
      case 'cancelled':  return 'bg-slate-100';
      case 'backlog':    return 'bg-purple-50';
      default:           return 'bg-slate-50';
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plane Issues</h1>
          <p className="mt-1 text-sm text-slate-500">
            Lalarente · {issues.length} issue{issues.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
        >
          {showCreate ? 'Cancel' : '+ New Issue'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-amber-800">Create Issue</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="block w-full rounded-lg border border-amber-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Issue title"
              />
            </div>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as PlaneIssue['priority'])}
              className="rounded-lg border border-amber-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-amber-600" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Empty */}
      {!loading && !error && issues.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">No issues yet. Create one to get started.</p>
        </div>
      )}

      {/* Issues table */}
      {!loading && issues.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600">Title</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Priority</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Assignees</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((issue) => {
                  const state = stateMap.get(issue.state);
                  return (
                    <tr key={issue.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{issue.name}</td>
                      <td className="px-4 py-3">
                        {state ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${groupBg(state.group)}`}
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: state.color }}
                            />
                            {state.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {issue.assignees?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {issue.assignees.map((uid) => {
                              const m = memberMap.get(uid);
                              const name = m?.display_name ?? uid.slice(0, 6);
                              const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                              return (
                                <span
                                  key={uid}
                                  title={name}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700"
                                >
                                  {initials}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(issue.created_at).toLocaleDateString('en-ZA')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
