import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import dayjs from 'dayjs'
import { Users, CheckCircle, XCircle, AlertTriangle, TrendingUp, RefreshCw, Send } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [expiringSoon, setExpiringSoon] = useState([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [sendingId, setSendingId] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [statsRes, clientsRes] = await Promise.all([
        api.get('/clients/stats'),
        api.get('/clients?status=active'),
      ])
      setStats(statsRes.data)

      const today = dayjs()
      const soon = clientsRes.data.filter(c => {
        const end = dayjs(c.subscription_end)
        const diff = end.diff(today, 'day')
        return diff >= 0 && diff <= 3
      })
      setExpiringSoon(soon)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function sendReminder(clientId, e) {
    e.preventDefault()
    e.stopPropagation()
    setSendingId(clientId)
    try {
      await api.post(`/admin/send-reminder/${clientId}`)
      alert('Напоминание отправлено!')
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setSendingId(null)
    }
  }

  async function runManualCheck() {
    setChecking(true)
    try {
      await api.post('/admin/check-subscriptions')
      alert('Проверка выполнена успешно!')
      loadData()
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setChecking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
          <p className="text-gray-500 text-sm mt-0.5">{dayjs().format('D MMMM YYYY')}</p>
        </div>
        <button
          onClick={runManualCheck}
          disabled={checking}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Проверка...' : 'Проверить подписки'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Всего клиентов" value={stats?.total || 0} color="bg-blue-500" />
        <StatCard icon={CheckCircle} label="Активных" value={stats?.active || 0} color="bg-green-500" />
        <StatCard icon={XCircle} label="Отключённых" value={stats?.expired || 0} color="bg-red-500" />
        <StatCard icon={TrendingUp} label="Доход/мес" value={`${stats?.monthlyRevenue || 0}₽`} color="bg-purple-500" />
      </div>

      {/* Expiring soon */}
      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="font-semibold text-amber-800">
              Заканчиваются скоро ({expiringSoon.length})
            </h2>
          </div>
          <div className="space-y-2">
            {expiringSoon.map(client => {
              const daysLeft = dayjs(client.subscription_end).diff(dayjs(), 'day')
              return (
                <div key={client.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5">
                  <Link to={`/clients/${client.id}`} className="flex-1 flex items-center gap-3 hover:opacity-80">
                    <div>
                      <span className="font-medium text-gray-800">{client.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{client.phone}</span>
                    </div>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                      daysLeft === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {daysLeft === 0 ? 'Сегодня' : `${daysLeft} дн.`}
                    </span>
                  </Link>
                  {client.phone && (
                    <button
                      onClick={e => sendReminder(client.id, e)}
                      disabled={sendingId === client.id}
                      title="Отправить напоминание в WhatsApp"
                      className="ml-3 p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {sendingId === client.id
                        ? <RefreshCw size={14} className="animate-spin" />
                        : <Send size={14} />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick link */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/clients" className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-blue-300 transition-colors group">
          <Users size={24} className="text-blue-500 mb-2" />
          <h3 className="font-semibold text-gray-800 group-hover:text-blue-600">Управление клиентами</h3>
          <p className="text-sm text-gray-500 mt-1">Добавить, продлить, отключить</p>
        </Link>
        <Link to="/payments" className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-blue-300 transition-colors group">
          <TrendingUp size={24} className="text-purple-500 mb-2" />
          <h3 className="font-semibold text-gray-800 group-hover:text-purple-600">История платежей</h3>
          <p className="text-sm text-gray-500 mt-1">Все транзакции</p>
        </Link>
      </div>
    </div>
  )
}
