export interface PlaneIssue {
  id: string;
  name: string;
  description_html?: string;
  state: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  created_at: string;
  updated_at: string;
  created_by: string;
  assignees: string[];
  labels: string[];
}

const PLANE_API_BASE = 'https://api.plane.so/api/v1';

function getHeaders(): Record<string, string> {
  const apiKey = import.meta.env.VITE_PLANE_API_KEY || '';
  const workspaceSlug = import.meta.env.VITE_PLANE_WORKSPACE_SLUG || '';
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
    'X-Workspace-Slug': workspaceSlug,
  };
}

export async function getIssues(projectId: string): Promise<PlaneIssue[]> {
  const res = await fetch(
    `${PLANE_API_BASE}/workspaces/${import.meta.env.VITE_PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error(`Plane API error: ${res.status}`);
  const json = await res.json();
  return json.results ?? [];
}

export async function createIssue(
  projectId: string,
  data: { name: string; description_html?: string; priority?: PlaneIssue['priority'] }
): Promise<PlaneIssue> {
  const res = await fetch(
    `${PLANE_API_BASE}/workspaces/${import.meta.env.VITE_PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error(`Plane API error: ${res.status}`);
  return res.json();
}

export async function updateIssue(
  projectId: string,
  issueId: string,
  data: Partial<PlaneIssue>
): Promise<PlaneIssue> {
  const res = await fetch(
    `${PLANE_API_BASE}/workspaces/${import.meta.env.VITE_PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issueId}`,
    {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error(`Plane API error: ${res.status}`);
  return res.json();
}
