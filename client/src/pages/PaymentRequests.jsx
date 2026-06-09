import React, { useState, useEffect } from 'react'
import api from '../api.js'
import dayjs from 'dayjs'
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'

function StatusBadge({ status }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={11} />Принята</span>
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={11} />Отклонена</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock size={11} />Ожидает</span>
}

export default function PaymentRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/admin/payment-requests')
      setRequests(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAction(id, action) {
    setProcessing(id + action)
    try {
      await api.post(`/admin/payment-requests/${id}/${action}`)
      await load()
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setProcessing(null)
    }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Заявки на оплату</h1>
          {pending.length > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">{pending.length} ожидают проверки</p>
          )}
        </div>
        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Clock size={36} className="mx-auto mb-2 opacity-40" />
          <p>Заявок пока нет</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Ожидающие */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Ожидают проверки</h2>
              <div className="space-y-2">
                {pending.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border-2 border-amber-200 p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{r.client_name}</p>
                      <p className="text-sm text-gray-500">{r.client_phone}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{dayjs(r.created_at).format('DD.MM.YYYY HH:mm')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-gray-900">{r.amount}₽</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(r.id, 'approve')}
                        disabled={!!processing}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {processing === r.id + 'approve' ? <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full inline-block" /> : <CheckCircle size={14} />}
                        Принять
                      </button>
                      <button
                        onClick={() => handleAction(r.id, 'reject')}
                        disabled={!!processing}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {processing === r.id + 'reject' ? <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full inline-block" /> : <XCircle size={14} />}
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Обработанные */}
          {resolved.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">История</h2>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Клиент</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Сумма</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Дата</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resolved.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-medium text-gray-900">{r.client_name}</p>
                          <p className="text-xs text-gray-400">{r.client_phone}</p>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-900">{r.amount}₽</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{dayjs(r.created_at).format('DD.MM HH:mm')}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
