import { useState } from 'react';
import { getIssues, createIssue, type PlaneIssue } from '../lib/planeApi';

export default function DevPlanePage() {
  const [projectId, setProjectId] = useState(
    () => import.meta.env.VITE_PLANE_PROJECT_ID || ''
  );
  const [issues, setIssues] = useState<PlaneIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<PlaneIssue['priority']>('medium');

  async function handleFetch() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getIssues(projectId);
      setIssues(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim() || !projectId) return;
    try {
      await createIssue(projectId, {
        name: newTitle.trim(),
        priority: newPriority,
      });
      setNewTitle('');
      setShowCreate(false);
      handleFetch();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create issue');
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case 'urgent':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'medium':
        return 'bg-amber-100 text-amber-700';
      case 'low':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-400';
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Plane Issues</h1>
        <p className="mt-1 text-sm text-slate-500">
          CRUD access to Plane.so issues for project tracking
        </p>
      </div>

      {/* Project ID input */}
      <div className="mb-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700">
            Project ID
          </label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="plane-project-id"
          />
        </div>
        <button
          onClick={handleFetch}
          disabled={loading || !projectId}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Fetch Issues'}
        </button>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          {showCreate ? 'Cancel' : '+ New Issue'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-amber-800">
            Create Issue
          </h3>
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
              onChange={(e) =>
                setNewPriority(e.target.value as PlaneIssue['priority'])
              }
              className="rounded-lg border border-amber-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Issues list */}
      {issues.length === 0 && !loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">
            Enter a Project ID and click "Fetch Issues" to load Plane issues.
          </p>
        </div>
      )}

      {issues.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    Title
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    Priority
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    State
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {issue.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColor(issue.priority)}`}
                      >
                        {issue.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {issue.state}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(issue.created_at).toLocaleDateString('en-ZA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
