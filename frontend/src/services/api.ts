import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3333',
});

// Injeta token em todas as requisições
// frontend/src/services/api.ts
// frontend/src/services/api.ts
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  
  // Verifica se config e config.headers existem para satisfazer o TypeScript
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Redireciona para login se 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/admin/login') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_type');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
