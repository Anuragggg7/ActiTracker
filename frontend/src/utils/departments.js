import api from '../api/client';

export const DEFAULT_DEPARTMENTS = [
  { _id: 'AIML', name: 'Artificial Intelligence & Machine Learning', code: 'AIML' },
  { _id: 'AIDS', name: 'Artificial Intelligence & Data Science', code: 'AIDS' },
  { _id: 'CE', name: 'Computer Engineering', code: 'CE' },
  { _id: 'IT', name: 'Information Technology', code: 'IT' },
  { _id: 'ME', name: 'Mechanical Engineering', code: 'ME' },
  { _id: 'CIVIL', name: 'Civil Engineering', code: 'CIVIL' },
  { _id: 'EE', name: 'Electrical Engineering', code: 'EE' },
  { _id: 'EXTC', name: 'Electronics & Telecommunication', code: 'EXTC' },
  { _id: 'TP', name: 'Training & Placement Cell', code: 'TP' }
];

export const fetchDepartmentsWithFallback = async () => {
  try {
    const res = await api.get('/departments');
    if (res && res.success && Array.isArray(res.departments) && res.departments.length > 0) {
      return res.departments;
    }
  } catch (err) {
    console.warn('API fetch departments error, utilizing fallback master list:', err?.message || err);
  }
  return DEFAULT_DEPARTMENTS;
};
