import api from '../api/client';

export const fetchDepartments = async () => {
  try {
    const res = await api.get('/departments');
    if (res && res.success && Array.isArray(res.departments)) {
      return res.departments;
    }
  } catch (err) {
    console.warn('API fetch departments error:', err?.message || err);
  }
  return [];
};

export const fetchDepartmentsWithFallback = fetchDepartments;

