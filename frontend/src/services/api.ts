import axios from 'axios';

// Usa o mesmo host que serviu o frontend (localhost, IP da VM na rede local,
// etc.), só trocando a porta pra do backend — assim funciona tanto acessando
// de dentro da máquina quanto de outro dispositivo na mesma rede.
const apiBaseUrl = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3333`;

const api = axios.create({
  baseURL: apiBaseUrl,
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
        const userType = localStorage.getItem('user_type');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_type');
        window.location.href = userType === 'admin' ? '/admin/login' : '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
