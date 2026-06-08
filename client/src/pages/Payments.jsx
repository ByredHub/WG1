import React, { useState, useEffect } from 'react'
import api from '../api.js'
import dayjs from 'dayjs'
import { CreditCard, CheckCircle, Clock } from 'lucide-react'

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

  async function loadPayments() {
    try {
      const res = await api.get('/payments')
      setPayments(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Платежи</h1>
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-right">
          <p className="text-xs text-green-600 font-medium">Всего получено</p>
          <p className="text-2xl font-bold text-green-700">{totalPaid.toLocaleString('ru')}₽</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CreditCard size={32} className="mx-auto mb-2 opacity-40" />
            <p>Платежей пока нет</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Клиент</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Телефон</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Дата</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.client_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{p.client_phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {dayjs(p.paid_at || p.created_at).format('DD.MM.YYYY HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    {p.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle size={11} /> Оплачен
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        <Clock size={11} /> Ожидание
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{p.amount}₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
