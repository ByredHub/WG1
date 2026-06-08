import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api.js'
import dayjs from 'dayjs'
import {
  ArrowLeft, Phone, Wifi, WifiOff, RefreshCw, CreditCard,
  Pencil, Trash2, CheckCircle, XCircle, Clock, Send, Gift, MessageCircle, X
} from 'lucide-react'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({})
  const [peers, setPeers] = useState([])
  const [showMsgModal, setShowMsgModal] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)

  useEffect(() => {
    loadClient()
    loadPeers()
  }, [id])

  async function loadClient() {
    try {
      const res = await api.get(`/clients/${id}`)
      setClient(res.data)
      setForm({
        name: res.data.name,
        phone: res.data.phone,
        wg_peer_id: res.data.wg_peer_id || '',
        wg_peer_name: res.data.wg_peer_name || '',
        subscription_end: res.data.subscription_end || '',
        notes: res.data.notes || '',
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadPeers() {
    try {
      const res = await api.get('/clients/wg/peers')
      setPeers(res.data)
    } catch {}
  }

  async function handleRenew() {
    setActionLoading(true)
    try {
      await api.post(`/clients/${id}/renew`, { days: 30 })
      await loadClient()
      alert('Подписка продлена на 30 дней!')
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleToggle(action) {
    setActionLoading(true)
    try {
      await api.post(`/clients/${id}/toggle`, { action })
      await loadClient()
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleManualPayment() {
    if (!confirm('Подтвердить ручную оплату 250₽?')) return
    setActionLoading(true)
    try {
      await api.post('/payments/manual', { client_id: id })
      await loadClient()
      alert('Оплата подтверждена, подписка продлена!')
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCreatePaymentLink() {
    setActionLoading(true)
    try {
      const res = await api.post('/payments/create', { client_id: id })
      window.open(res.data.payment_url, '_blank')
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSendMessage() {
    if (!msgText.trim()) return
    setMsgSending(true)
    try {
      await api.post('/admin/send-message', { client_id: id, message: msgText })
      setShowMsgModal(false)
      setMsgText('')
      alert('Сообщение отправлено!')
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setMsgSending(false)
    }
  }

  async function handleSaveEdit() {
    setActionLoading(true)
    try {
      const selectedPeer = peers.find(p => p.id === form.wg_peer_id)
      const payload = {
        ...form,
        wg_peer_name: selectedPeer ? selectedPeer.name : form.wg_peer_name,
      }
      await api.patch(`/clients/${id}`, payload)
      setEditMode(false)
      await loadClient()
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Удалить клиента ${client.name}? Это действие нельзя отменить.`)) return
    try {
      await api.delete(`/clients/${id}`)
      navigate('/clients')
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!client) {
    return <div className="p-6 text-gray-500">Клиент не найден</div>
  }

  const daysLeft = client.subscription_end ? dayjs(client.subscription_end).diff(dayjs(), 'day') : null
  const isActive = client.status === 'active'
  const isFree = !!client.is_free

  async function handleToggleFree() {
    try {
      await api.patch(`/clients/${id}`, { is_free: isFree ? 0 : 1 })
      await loadClient()
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/clients" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          {editMode ? (
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent"
            />
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              {isFree && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                  <Gift size={11} /> Бесплатно
                </span>
              )}
            </div>
          )}
          <p className="text-gray-500 text-sm mt-0.5">
            Добавлен {dayjs(client.created_at).format('DD.MM.YYYY')}
          </p>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button onClick={() => setEditMode(false)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Отмена</button>
              <button onClick={handleSaveEdit} disabled={actionLoading} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Сохранить</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditMode(true)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><Pencil size={18} /></button>
              <button onClick={handleDelete} className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Info card */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Информация</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-gray-400 shrink-0" />
              {editMode ? (
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Телефон"
                />
              ) : (
                <span className="text-gray-700">{client.phone}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Wifi size={16} className="text-gray-400 shrink-0" />
              {editMode ? (
                <select
                  value={form.wg_peer_id}
                  onChange={e => setForm({ ...form, wg_peer_id: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— не привязан —</option>
                  {peers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.address})</option>
                  ))}
                </select>
              ) : (
                <span className="text-gray-700 font-mono text-sm">
                  {client.wg_peer_name || <span className="text-gray-400 font-sans">Пир не привязан</span>}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Clock size={16} className="text-gray-400 shrink-0" />
              {editMode ? (
                <input
                  type="date"
                  value={form.subscription_end}
                  onChange={e => setForm({ ...form, subscription_end: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-gray-700">
                  {client.subscription_end ? (
                    <>
                      до {dayjs(client.subscription_end).format('DD.MM.YYYY')}
                      {daysLeft !== null && (
                        <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                          daysLeft < 0 ? 'bg-red-100 text-red-700' :
                          daysLeft <= 3 ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {daysLeft < 0 ? `просрочено ${Math.abs(daysLeft)} дн.` : daysLeft === 0 ? 'сегодня' : `${daysLeft} дн.`}
                        </span>
                      )}
                    </>
                  ) : '—'}
                </span>
              )}
            </div>

            {(editMode || client.notes) && (
              <div className="pt-2 border-t border-gray-50">
                {editMode ? (
                  <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Заметки..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                ) : (
                  <p className="text-gray-500 text-sm">{client.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status + actions */}
        <div className="space-y-3">
          <div className={`rounded-xl p-5 border ${isActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {isActive
                ? <CheckCircle size={18} className="text-green-600" />
                : <XCircle size={18} className="text-red-600" />
              }
              <span className={`font-semibold ${isActive ? 'text-green-800' : 'text-red-800'}`}>
                {isActive ? 'VPN активен' : 'VPN отключён'}
              </span>
            </div>
            <p className={`text-sm ${isActive ? 'text-green-600' : 'text-red-600'}`}>
              {isActive ? `Истекает ${dayjs(client.subscription_end).format('DD.MM.YYYY')}` : 'Подписка истекла'}
            </p>
          </div>

          <button
            onClick={handleManualPayment}
            disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <CheckCircle size={16} />
            Оплата получена (+30 дней)
          </button>

          <button
            onClick={handleCreatePaymentLink}
            disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <CreditCard size={16} />
            Ссылка на оплату
          </button>

          <button
            onClick={() => handleToggle(isActive ? 'disable' : 'enable')}
            disabled={actionLoading || !client.wg_peer_id}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
              isActive
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            {isActive ? <WifiOff size={16} /> : <Wifi size={16} />}
            {isActive ? 'Отключить VPN' : 'Включить VPN'}
          </button>

          <button
            onClick={handleToggleFree}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
              isFree
                ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            <Gift size={16} />
            {isFree ? 'Бесплатный доступ (убрать)' : 'Сделать бесплатным'}
          </button>

          {client.phone && (
            <button
              onClick={() => {
                setMsgText(`Привет, ${client.name}! `)
                setShowMsgModal(true)
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <MessageCircle size={16} />
              Отправить WhatsApp сообщение
            </button>
          )}
        </div>
      </div>

      {/* Модалка отправки сообщения */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle size={18} className="text-green-500" />
                Сообщение для {client.name}
              </h3>
              <button onClick={() => setShowMsgModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-2">Номер: {client.phone}</p>
            <textarea
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              rows={5}
              autoFocus
              placeholder="Текст сообщения..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowMsgModal(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSendMessage}
                disabled={msgSending || !msgText.trim()}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Send size={14} />
                {msgSending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment history */}
      {client.payments?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3">История платежей</h2>
          <div className="space-y-2">
            {client.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>{p.status === 'paid' ? 'Оплачен' : 'Ожидание'}</span>
                  <span className="text-sm text-gray-500 ml-2">{dayjs(p.created_at).format('DD.MM.YYYY HH:mm')}</span>
                </div>
                <span className="font-semibold text-gray-800">{p.amount}₽</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications history */}
      {client.notifications?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">История уведомлений</h2>
          <div className="space-y-1.5">
            {client.notifications.map(n => (
              <div key={n.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                <Send size={13} className="text-gray-300 shrink-0" />
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  n.type === 'reminder' ? 'bg-amber-100 text-amber-700' :
                  n.type === 'expired' ? 'bg-red-100 text-red-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {n.type === 'reminder' ? 'напоминание' : n.type === 'expired' ? 'отключение' : 'активация'}
                </span>
                <span className="text-gray-400 text-xs ml-auto shrink-0">{dayjs(n.sent_at).format('DD.MM HH:mm')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
