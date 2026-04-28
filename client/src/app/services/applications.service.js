// /services/applications.service.js
import { http } from "./http";

function withQuery(base, query = {}) {
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, v);
  });
  return q.toString() ? `${base}?${q.toString()}` : base;
}

export const applicationsService = {
  // GET /api/application
  list: async (query) => {
    const json = await http.get(withQuery("/application", query));
    return Array.isArray(json?.data) ? json.data : [];
  },

  // GET /api/application?userId=...
  listByUser: async (userId, extraFilters = {}) => {
    const query = { userId, ...extraFilters };
    const json = await http.get(withQuery("/application", query));
    return Array.isArray(json?.data) ? json.data : [];
  },

  // GET /api/application/:id
  getById: async (id) => {
    const json = await http.get(`/application/${id}`);
    return json?.data ?? json;
  },

  // POST /api/application
  create: async (payload) => {
    const json = await http.post("/application", payload);
    return json?.data ?? json;
  },

  // PATCH /api/application/:id
  update: async (id, payload) => {
    const json = await http.patch(`/application/${id}`, payload);
    return json?.data ?? json;
  },

  // DELETE /api/application/:id
  remove: async (id) => {
    return http.del(`/application/${id}`);
  },

  // POST /api/application/:id/accept
  accept: async (id, reason) => {
    const body = reason ? { reason } : {};
    const json = await http.post(`/application/${id}/accept`, body);
    return json?.data ?? json;
  },

  // POST /api/application/:id/reject
  reject: async (id, reason) => {
    const body = reason ? { reason } : {};
    const json = await http.post(`/application/${id}/reject`, body);
    return json?.data ?? json;
  },

  // POST /api/application/:id/cancel
  cancel: async (id, reason) => {
    const body = reason ? { reason } : {};
    const json = await http.post(`/application/${id}/cancel`, body);
    return json?.data ?? json;
  },
};
