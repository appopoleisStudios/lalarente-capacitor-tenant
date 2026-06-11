import { supabase } from './supabaseClient';

export interface PlaneIssue {
  id: string;
  name: string;
  description_html?: string;
  state: string; // state UUID
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  created_at: string;
  updated_at: string;
  created_by: string;
  assignees: string[];
  labels: string[];
}

export interface PlaneState {
  id: string;
  name: string;
  color: string;
  group: 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';
}

const PROJECT_ID = import.meta.env.VITE_PLANE_PROJECT_ID || '';

async function planeRequest(method: string, resource: string, extra?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-proxy', {
    body: { target: 'plane', method, projectId: PROJECT_ID, resource, ...extra },
  });
  if (error) throw new Error(error.message || 'Plane request failed');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getIssues(): Promise<PlaneIssue[]> {
  const data = await planeRequest('GET', 'issues');
  return data?.results ?? [];
}

export async function getStates(): Promise<PlaneState[]> {
  const data = await planeRequest('GET', 'states');
  return data?.results ?? [];
}

export interface PlaneMember {
  id: string; // member user UUID (not membership UUID)
  display_name: string;
  avatar: string | null;
}

export async function getMembers(): Promise<PlaneMember[]> {
  const data = await planeRequest('GET', 'members');
  // Plane project members endpoint returns a flat array: [{ id, display_name, avatar, ... }]
  const results: any[] = Array.isArray(data) ? data : (data?.results ?? []);
  return results.map((r) => ({
    id: r.member?.id ?? r.id,
    display_name: r.member?.display_name ?? r.display_name ?? r.first_name ?? 'Unknown',
    avatar: r.member?.avatar_url ?? r.member?.avatar ?? r.avatar_url ?? r.avatar ?? null,
  }));
}

export async function createIssue(
  issueData: { name: string; description_html?: string; priority?: PlaneIssue['priority'] }
): Promise<PlaneIssue> {
  return planeRequest('POST', 'issues', issueData);
}

export async function updateIssue(
  issueId: string,
  issueData: Partial<PlaneIssue>
): Promise<PlaneIssue> {
  return planeRequest('PATCH', 'issues', { issueId, ...issueData });
}

export interface PlaneComment {
  id: string;
  comment_html: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function getComments(issueId: string): Promise<PlaneComment[]> {
  const data = await planeRequest('GET', `issues/${issueId}/comments`);
  return data?.results ?? [];
}

export async function createComment(issueId: string, commentHtml: string): Promise<PlaneComment> {
  return planeRequest('POST', `issues/${issueId}/comments`, { comment_html: commentHtml });
}

export async function updateComment(issueId: string, commentId: string, commentHtml: string): Promise<PlaneComment> {
  return planeRequest('PATCH', `issues/${issueId}/comments`, { issueId: commentId, comment_html: commentHtml });
}

export async function deleteComment(issueId: string, commentId: string): Promise<void> {
  return planeRequest('DELETE', `issues/${issueId}/comments`, { issueId: commentId });
}
