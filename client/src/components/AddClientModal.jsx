import React, { useState, useEffect } from 'react'
import api from '../api.js'
import { X, Wifi } from 'lucide-react'

export default function AddClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    wg_peer_id: '',
    router_model: '',
    notes: '',
    days: 30,
  })
  const [peers, setPeers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/clients/wg/peers').then(res => setPeers(res.data)).catch(() => {})
  }, [])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const selectedPeer = peers.find(p => p.id === form.wg_peer_id)
      await api.post('/clients', {
        ...form,
        wg_peer_name: selectedPeer ? selectedPeer.name : '',
        router_model: form.router_model || undefined,
      })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания клиента')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Новый клиент</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              placeholder="Иван Иванов"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Телефон WhatsApp *</label>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              required
              placeholder="+7 900 000 00 00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Модель роутера</label>
            <input
              value={form.router_model}
              onChange={e => set('router_model', e.target.value)}
              placeholder="напр. Keenetic Speedster"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1.5"><Wifi size={13} /> WireGuard пир</span>
            </label>
            <select
              value={form.wg_peer_id}
              onChange={e => set('wg_peer_id', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— выбрать пир —</option>
              {peers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.address}) {p.enabled ? '✓' : '✗'}
                </option>
              ))}
            </select>
            {peers.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Нет подключения к WG Easy или пиров нет</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дней подписки</label>
            <input
              type="number"
              value={form.days}
              onChange={e => set('days', parseInt(e.target.value) || 30)}
              min={1}
              max={365}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Адрес, модель роутера..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
