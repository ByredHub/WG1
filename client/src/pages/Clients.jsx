import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { Plus, Search, CheckCircle, XCircle, Clock, Filter, Gift, Pencil, X, Check, Trash2, Download, PlusCircle, GripVertical, FileDown } from 'lucide-react'
import AddClientModal from '../components/AddClientModal.jsx'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#eff6ff' : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  }
  return (
    <tr ref={setNodeRef} style={style}>
      <td className="w-8 px-2 py-2.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500" {...attributes} {...listeners}>
        <GripVertical size={15} />
      </td>
      {children}
    </tr>
  )
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
  const [creatingPeer, setCreatingPeer] = useState(false)
  const [newPeerName, setNewPeerName] = useState('')
  const [showNewPeer, setShowNewPeer] = useState(false)

  useEffect(() => {
    loadClients()
  }, [statusFilter])

  useEffect(() => {
    loadPeers()
  }, [])

  async function loadPeers() {
    api.get('/clients/wg/peers').then(res => setPeers(res.data)).catch(() => {})
  }

  async function handleCreatePeer(onCreated) {
    if (!newPeerName.trim()) return
    setCreatingPeer(true)
    try {
      const res = await api.post('/clients/wg/peers', { name: newPeerName.trim() })
      const peer = res.data
      await loadPeers()
      setNewPeerName('')
      setShowNewPeer(false)
      if (onCreated) onCreated(peer)
    } catch (err) {
      alert('Ошибка создания пира: ' + (err.response?.data?.error || err.message))
    } finally {
      setCreatingPeer(false)
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = clients.findIndex(c => c.id === active.id)
    const newIndex = clients.findIndex(c => c.id === over.id)
    const newOrder = arrayMove(clients, oldIndex, newIndex)
    setClients(newOrder)
    try {
      await api.patch('/clients/reorder', { ids: newOrder.map(c => c.id) })
    } catch (err) {
      console.error('reorder failed', err)
    }
  }

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

  function exportToExcel() {
    const rows = filtered.map(c => ({
      'Имя': c.name,
      'Телефон': c.phone || '',
      'Модель роутера': c.router_model || '',
      'WG пир': c.wg_peer_name || '',
      'Подписка до': c.subscription_end ? dayjs(c.subscription_end).format('DD.MM.YYYY') : '',
      'Статус': c.status === 'active' ? 'Активен' : 'Отключён',
      'Бесплатный': c.is_free ? 'Да' : 'Нет',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Автоширина колонок
    const cols = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2
    }))
    ws['!cols'] = cols
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Клиенты')
    XLSX.writeFile(wb, `clients_${dayjs().format('YYYY-MM-DD')}.xlsx`)
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
      router_model: client.router_model || '',
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
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Excel
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Добавить клиента
          </button>
        </div>
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
      <DndContext sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                <th className="w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Клиент</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Телефон</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Роутер</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">WG пир</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Подписка до</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <SortableContext items={filtered.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(client => {
                const isEditing = editingId === client.id
                return (
                  <SortableRow key={client.id} id={client.id}>

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

                    {/* Роутер */}
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <InlineEdit
                          value={editForm.router_model}
                          onChange={v => setEditForm(f => ({ ...f, router_model: v }))}
                          className="w-32"
                          onKeyDown={e => handleKeyDown(e, client.id)}
                        />
                      ) : (
                        <span className="text-gray-600 text-sm">{client.router_model || <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>

                    {/* WG пир */}
                    <td className="px-4 py-2.5 text-gray-500 text-sm">
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <select
                              value={editForm.wg_peer_id}
                              onChange={e => {
                                const p = peers.find(p => p.id === e.target.value)
                                setEditForm(f => ({ ...f, wg_peer_id: e.target.value, wg_peer_name: p ? p.name : '' }))
                              }}
                              onClick={ev => ev.stopPropagation()}
                              className="border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white max-w-[130px]"
                            >
                              <option value="">— не выбран —</option>
                              {peers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={ev => { ev.stopPropagation(); setShowNewPeer(showNewPeer === client.id ? false : client.id) }}
                              title="Создать новый пир"
                              className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            >
                              <PlusCircle size={15} />
                            </button>
                          </div>
                          {showNewPeer === client.id && (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={newPeerName}
                                onChange={e => setNewPeerName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleCreatePeer(peer => setEditForm(f => ({ ...f, wg_peer_id: peer.id, wg_peer_name: peer.name })))
                                  if (e.key === 'Escape') { setShowNewPeer(false); setNewPeerName('') }
                                }}
                                placeholder="Имя пира"
                                className="border border-green-400 rounded px-2 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-green-400"
                              />
                              <button
                                onClick={() => handleCreatePeer(peer => setEditForm(f => ({ ...f, wg_peer_id: peer.id, wg_peer_name: peer.name })))}
                                disabled={creatingPeer}
                                className="text-xs px-2 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50"
                              >
                                {creatingPeer ? '...' : 'Создать'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono">{client.wg_peer_name || <span className="text-gray-300">—</span>}</span>
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
                          {client.wg_peer_id && (
                            <button
                              onClick={async e => {
                                e.stopPropagation()
                                try {
                                  const res = await api.get(`/clients/wg/peers/${client.wg_peer_id}/config`, { responseType: 'blob' })
                                  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/plain' }))
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = `${(client.wg_peer_name || 'peer').replace(/[^a-zA-Z0-9_-]/g, '_')}.conf`
                                  a.click()
                                  URL.revokeObjectURL(url)
                                } catch (err) {
                                  alert('Ошибка скачивания: ' + (err.response?.data?.error || err.message))
                                }
                              }}
                              title="Скачать конфиг WireGuard (.conf)"
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <FileDown size={13} />
                            </button>
                          )}
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
                  </SortableRow>
                )
              })}
            </tbody>
            </SortableContext>
          </table>
        )}
      </DndContext>
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
