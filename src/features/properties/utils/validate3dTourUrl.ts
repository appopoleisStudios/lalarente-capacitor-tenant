/**
 * Checks an owner-entered 3D tour link before it is saved, so a dead link
 * can't put a "View in 3D" button on a listing that opens a "not found" page.
 * Returns null when the link is empty or live, otherwise a message to show.
 */
export async function validate3dTourUrl(raw: string): Promise<string | null> {
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'That is not a valid link.';
  }
  if (url.protocol !== 'https:') return 'The 3D tour link must start with https://';

  // Matterport's /show page returns 404 for a missing model, but its player
  // API answers more reliably; use it when we can read the model id.
  const modelId = url.hostname.endsWith('matterport.com') ? url.searchParams.get('m') : null;
  const checkUrl = modelId
    ? `https://my.matterport.com/api/v1/player/models/${encodeURIComponent(modelId)}/`
    : value;

  try {
    const res = await fetch(checkUrl, { method: 'GET' });
    if (res.status === 404 || res.status === 410) {
      return 'This 3D tour could not be found. Check the link and try again.';
    }
    if (res.status >= 400) {
      return `This 3D tour link is not reachable (HTTP ${res.status}). Check the link and try again.`;
    }
    return null;
  } catch {
    return "Couldn't check the 3D tour link. Check your connection and try again.";
  }
}
