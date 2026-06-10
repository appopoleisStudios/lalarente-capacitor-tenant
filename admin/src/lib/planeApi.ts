import { supabase } from './supabaseClient';

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

export async function getIssues(projectId: string): Promise<PlaneIssue[]> {
  const workspaceSlug = import.meta.env.VITE_PLANE_WORKSPACE_SLUG || '';
  const { data, error } = await supabase.functions.invoke('admin-proxy', {
    body: {
      target: 'plane',
      path: `v1/workspaces/${workspaceSlug}/projects/${projectId}/issues`,
    },
  });
  if (error) throw new Error(error.message || 'Failed to fetch Plane issues');
  if (data?.error) throw new Error(data.error);
  return data?.results ?? [];
}

export async function createIssue(
  projectId: string,
  issueData: { name: string; description_html?: string; priority?: PlaneIssue['priority'] }
): Promise<PlaneIssue> {
  const workspaceSlug = import.meta.env.VITE_PLANE_WORKSPACE_SLUG || '';
  const { data, error } = await supabase.functions.invoke('admin-proxy', {
    body: {
      target: 'plane',
      path: `v1/workspaces/${workspaceSlug}/projects/${projectId}/issues`,
      method: 'POST',
      body: issueData,
    },
  });
  if (error) throw new Error(error.message || 'Failed to create Plane issue');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateIssue(
  projectId: string,
  issueId: string,
  issueData: Partial<PlaneIssue>
): Promise<PlaneIssue> {
  const workspaceSlug = import.meta.env.VITE_PLANE_WORKSPACE_SLUG || '';
  const { data, error } = await supabase.functions.invoke('admin-proxy', {
    body: {
      target: 'plane',
      path: `v1/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}`,
      method: 'PATCH',
      body: issueData,
    },
  });
  if (error) throw new Error(error.message || 'Failed to update Plane issue');
  if (data?.error) throw new Error(data.error);
  return data;
}
