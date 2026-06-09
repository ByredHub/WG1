import React, { useState, useEffect } from 'react'
import api from '../api.js'
import { X, Wifi, PlusCircle } from 'lucide-react'

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
  const [showNewPeer, setShowNewPeer] = useState(false)
  const [newPeerName, setNewPeerName] = useState('')
  const [creatingPeer, setCreatingPeer] = useState(false)

  useEffect(() => {
    api.get('/clients/wg/peers').then(res => setPeers(res.data)).catch(() => {})
  }, [])

  async function handleCreatePeer() {
    if (!newPeerName.trim()) return
    setCreatingPeer(true)
    try {
      const res = await api.post('/clients/wg/peers', { name: newPeerName.trim() })
      const peer = res.data
      const updated = await api.get('/clients/wg/peers')
      setPeers(updated.data)
      set('wg_peer_id', peer.id)
      setNewPeerName('')
      setShowNewPeer(false)
    } catch (err) {
      setError('Ошибка создания пира: ' + (err.response?.data?.error || err.message))
    } finally {
      setCreatingPeer(false)
    }
  }

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
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">
                <span className="flex items-center gap-1.5"><Wifi size={13} /> WireGuard пир</span>
              </label>
              <button
                type="button"
                onClick={() => setShowNewPeer(v => !v)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                <PlusCircle size={13} />
                Создать новый
              </button>
            </div>
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
            {showNewPeer && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  value={newPeerName}
                  onChange={e => setNewPeerName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreatePeer() } if (e.key === 'Escape') setShowNewPeer(false) }}
                  placeholder="Имя нового пира"
                  className="flex-1 border border-green-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  type="button"
                  onClick={handleCreatePeer}
                  disabled={creatingPeer || !newPeerName.trim()}
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {creatingPeer ? '...' : 'Создать'}
                </button>
              </div>
            )}
            {peers.length === 0 && !showNewPeer && (
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
