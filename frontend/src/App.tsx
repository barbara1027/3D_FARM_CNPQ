import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { ClientLayout }   from './components/ClientLayout';
import { AdminLayout }    from './components/AdminLayout';
import { HomePage }       from './pages/HomePage';
import { LoginPage }      from './pages/LoginPage';
import { RegisterPage }   from './pages/RegisterPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { DashboardPage }  from './pages/DashboardPage';
import { NewOrderPage }   from './pages/NewOrderPage';
import { QuotesPage }     from './pages/QuotesPage';
import { AdminLoginPage }     from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminOrdersPage }    from './pages/admin/AdminOrdersPage';
import { AdminQuotesPage }    from './pages/admin/AdminQuotesPage';
import { AdminMaterialsPage } from './pages/admin/AdminMaterialsPage';
import { AdminPrintersPage }  from './pages/admin/AdminPrintersPage';
import { AdminQualidadesPage } from './pages/admin/AdminQualidadesPage';

// Lê localStorage diretamente — sem estado React, sem race condition
function getToken() { return localStorage.getItem('access_token'); }
function getUserType() { return localStorage.getItem('user_type'); }

function RequireAuth() {
  return getToken() ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireAdmin() {
  return (getToken() && getUserType() === 'admin')
    ? <Outlet />
    : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/"             element={<HomePage />} />
      <Route path="/login"        element={<LoginPage />} />
      <Route path="/register"     element={<RegisterPage />} />
      <Route path="/admin/login"  element={<AdminLoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Cliente — protegido */}
      <Route element={<ClientLayout />}>
        <Route element={<RequireAuth />}>
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/quotes"     element={<QuotesPage />} />
          <Route path="/new-order"  element={<NewOrderPage />} />
        </Route>
      </Route>

      {/* Admin — protegido */}
      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"  element={<AdminDashboardPage />} />
          <Route path="orders"     element={<AdminOrdersPage />} />
          <Route path="quotes"     element={<AdminQuotesPage />} />
          <Route path="materials"  element={<AdminMaterialsPage />} />
          <Route path="printers"   element={<AdminPrintersPage />} />
          <Route path="qualidades" element={<AdminQualidadesPage />} />
          <Route path="new-order"  element={<NewOrderPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
