const BASE_URL = 'http://localhost:3000/api/v1/webhooks';

export async function fetchStats() {
  const res = await fetch(`${BASE_URL}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  const json = await res.json();
  return json.data;
}

export async function fetchEvents(page = 1, status = 'ALL') {
  const url = `${BASE_URL}/events?page=${page}&limit=10&status=${status}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch events');
  const json = await res.json();
  return json.data;
}

export async function fetchEventById(id) {
  const res = await fetch(`${BASE_URL}/events/${id}`);
  if (!res.ok) throw new Error('Failed to fetch event detail');
  const json = await res.json();
  return json.data;
}

export async function retryEvent(id) {
  const res = await fetch(`${BASE_URL}/events/${id}/retry`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to retry event');
  return res.json();
}