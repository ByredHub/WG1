import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import ClientDetail from './pages/ClientDetail.jsx'
import Payments from './pages/Payments.jsx'
import Settings from './pages/Settings.jsx'
import WhatsAppConnect from './pages/WhatsAppConnect.jsx'
import Pay from './pages/Pay.jsx'
import PaymentRequests from './pages/PaymentRequests.jsx'
import Layout from './components/Layout.jsx'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/pay/:token" element={<Pay />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="payments" element={<Payments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="whatsapp" element={<WhatsAppConnect />} />
          <Route path="payment-requests" element={<PaymentRequests />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
