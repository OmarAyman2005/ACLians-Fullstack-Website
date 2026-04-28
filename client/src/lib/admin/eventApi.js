const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const api = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.message || data?.errors?.[0]?.msg || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return data;
};

// 🔹 Bazaar API functions
export const getAllBazaars = () => api('/bazaar');
export const getBazaarById = (id) => api(`/bazaar/${id}`);
export const createBazaar = (data) => api('/bazaar', { method: 'POST', body: data });
export const updateBazaar = (id, data) => api(`/bazaar/${id}`, { method: 'PUT', body: data });
export const deleteBazaar = (id) => api(`/event/${id}`, { method: 'DELETE' });

// 🔹 Conference API functions
export const getAllConferences = () => api('/conference');
export const getConferenceById = (id) => api(`/conference/${id}`);
export const createConference = (data) => api('/conference', { method: 'POST', body: data });
export const updateConference = (id, data) => api(`/conference/${id}`, { method: 'PUT', body: data });
export const deleteConference = (id) => api(`/event/${id}`, { method: 'DELETE' });

// 🔹 Trip API functions
export const getAllTrips = () => api('/trip');
export const getTripById = (id) => api(`/trip/${id}`);
export const createTrip = (data) => api('/trip', { method: 'POST', body: data });
export const updateTrip = (id, data) => api(`/trip/${id}`, { method: 'PUT', body: data });
export const deleteTrip = (id) => api(`/event/${id}`, { method: 'DELETE' });

// 🔹 Workshop API functions
export const getAllWorkshops = () => api('/workshop');
export const getWorkshopById = (id) => api(`/workshop/${id}`);
export const createWorkshop = (data) => api('/workshop', { method: 'POST', body: data });
export const updateWorkshop = (id, data) => api(`/workshop/${id}`, { method: 'PUT', body: data });
export const deleteWorkshop = (id) => api(`/event/${id}`, { method: 'DELETE' });
