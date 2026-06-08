import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, CreditCard, LogOut, Shield, MessageCircle, Settings } from 'lucide-react'

export default function Layout() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">WG Manager</h1>
              <p className="text-gray-400 text-xs">Управление VPN</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <LayoutDashboard size={18} />
            Дашборд
          </NavLink>
          <NavLink
            to="/clients"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Users size={18} />
            Клиенты
          </NavLink>
          <NavLink
            to="/payments"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <CreditCard size={18} />
            Платежи
          </NavLink>

          <div className="pt-2 mt-2 border-t border-gray-700">
            <NavLink
              to="/whatsapp"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-green-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <MessageCircle size={18} />
              WhatsApp
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Settings size={18} />
              Настройки
            </NavLink>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
