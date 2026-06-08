import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import dayjs from 'dayjs'
import { Plus, Search, CheckCircle, XCircle, Clock, Filter, Gift, Pencil, X, Check, Trash2 } from 'lucide-react'
import AddClientModal from '../components/AddClientModal.jsx'

function StatusBadge({ status, subscriptionEnd }) {
  const daysLeft = dayjs(subscriptionEnd).diff(dayjs(), 'day')
  if (status === 'expired') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={12} />Отключён</span>
  }
  if (daysLeft <= 3) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock size={12} />{daysLeft <= 0 ? 'Сегодня' : `${daysLeft} дн.`}</span>
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={12} />Активен</span>
}

function InlineEdit({ value, onChange, onKeyDown, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onClick={e => e.stopPropagation()}
      className={`border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white ${className}`}
      autoFocus
    />
  )
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [peers, setPeers] = useState([])

  useEffect(() => {
    loadClients()
  }, [statusFilter])

  useEffect(() => {
    api.get('/clients/wg/peers').then(res => setPeers(res.data)).catch(() => {})
  }, [])

  async function loadClients() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await api.get(`/clients?${params}`)
      setClients(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    loadClients()
  }

  async function handleDelete(clientId, clientName, e) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Удалить клиента «${clientName}»?`)) return
    try {
      await api.delete(`/clients/${clientId}`)
      await loadClients()
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    }
  }

  function startEdit(client, e) {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(client.id)
    setEditForm({
      name: client.name,
      phone: client.phone || '',
      subscription_end: client.subscription_end || '',
      wg_peer_id: client.wg_peer_id || '',
      wg_peer_name: client.wg_peer_name || '',
    })
  }

  function cancelEdit(e) {
    e?.stopPropagation()
    setEditingId(null)
    setEditForm({})
  }

  async function saveEdit(clientId, e) {
    e?.stopPropagation()
    setSaving(true)
    try {
      await api.patch(`/clients/${clientId}`, editForm)
      setEditingId(null)
      await loadClients()
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e, clientId) {
    if (e.key === 'Enter') saveEdit(clientId, e)
    if (e.key === 'Escape') cancelEdit(e)
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Клиенты</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Добавить клиента
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Имя или номер телефона..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
            Найти
          </button>
        </form>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['all', 'Все'], ['active', 'Активные'], ['expired', 'Отключённые']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === val ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Filter size={32} className="mx-auto mb-2 opacity-40" />
            <p>Клиентов не найдено</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Клиент</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Телефон</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">WG пир</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Подписка до</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(client => {
                const isEditing = editingId === client.id
                return (
                  <tr key={client.id} className={`group transition-colors ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>

                    {/* Имя */}
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <InlineEdit
                          value={editForm.name}
                          onChange={v => setEditForm(f => ({ ...f, name: v }))}
                          className="w-36"
                          onKeyDown={e => handleKeyDown(e, client.id)}
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Link to={`/clients/${client.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                            {client.name}
                          </Link>
                          {client.is_free ? <span title="Бесплатный"><Gift size={13} className="text-purple-400" /></span> : null}
                        </div>
                      )}
                    </td>

                    {/* Телефон */}
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <InlineEdit
                          value={editForm.phone}
                          onChange={v => setEditForm(f => ({ ...f, phone: v }))}
                          className="w-36"
                          onKeyDown={e => handleKeyDown(e, client.id)}
                        />
                      ) : (
                        <span className="text-gray-600 text-sm">{client.phone || <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>

                    {/* WG пир */}
                    <td className="px-4 py-2.5 text-gray-500 text-sm font-mono">
                      {isEditing ? (
                        <select
                          value={editForm.wg_peer_id}
                          onChange={e => {
                            const p = peers.find(p => p.id === e.target.value)
                            setEditForm(f => ({ ...f, wg_peer_id: e.target.value, wg_peer_name: p ? p.name : '' }))
                          }}
                          onClick={ev => ev.stopPropagation()}
                          className="border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white max-w-[150px]"
                        >
                          <option value="">— не выбран —</option>
                          {peers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        client.wg_peer_name || <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Подписка до */}
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <InlineEdit
                          type="date"
                          value={editForm.subscription_end}
                          onChange={v => setEditForm(f => ({ ...f, subscription_end: v }))}
                          onKeyDown={e => handleKeyDown(e, client.id)}
                        />
                      ) : (
                        <span className="text-gray-600 text-sm">
                          {client.subscription_end ? dayjs(client.subscription_end).format('DD.MM.YYYY') : '—'}
                        </span>
                      )}
                    </td>

                    {/* Статус */}
                    <td className="px-4 py-2.5">
                      <StatusBadge status={client.status} subscriptionEnd={client.subscription_end} />
                    </td>

                    {/* Кнопки */}
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => saveEdit(client.id, e)}
                            disabled={saving}
                            title="Сохранить"
                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            title="Отмена"
                            className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => startEdit(client, e)}
                            title="Редактировать"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={e => handleDelete(client.id, client.name, e)}
                            title="Удалить"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); loadClients() }}
        />
      )}
    </div>
  )
}
