import React, { useState, useEffect, useRef } from 'react'
import api from '../api.js'
import { CheckCircle, XCircle, RefreshCw, Smartphone, Wifi } from 'lucide-react'
import QRCode from '../components/QRCode.jsx'

export default function WhatsAppConnect() {
  const [status, setStatus] = useState({ ready: false, initialized: false })
  const [qr, setQr] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | waiting_qr | qr | authenticated | ready | error
  const [restarting, setRestarting] = useState(false)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    checkStatus()
    startStream()
    return () => { eventSourceRef.current?.close() }
  }, [])

  async function checkStatus() {
    try {
      const res = await api.get('/admin/whatsapp-qr')
      setStatus(res.data.status)
      if (res.data.status.ready) { setPhase('ready'); return }
      if (res.data.qr) { setQr(res.data.qr); setPhase('qr'); return }
      setPhase('waiting_qr')
    } catch { setPhase('error') }
  }

  function startStream() {
    eventSourceRef.current?.close()

    const token = localStorage.getItem('token')
    const es = new EventSource(`/api/admin/whatsapp-qr-stream?token=${token}`)
    eventSourceRef.current = es

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'qr') { setQr(data.qr); setPhase('qr') }
      if (data.type === 'authenticated') setPhase('authenticated')
      if (data.type === 'ready') { setPhase('ready'); setStatus({ ready: true, initialized: true }); setQr(null) }
      if (data.type === 'disconnected') { setPhase('waiting_qr'); setStatus({ ready: false, initialized: false }); setQr(null) }
      if (data.type === 'auth_failure') setPhase('error')
    }
    es.onerror = () => setPhase('error')
  }

  async function handleRestart() {
    setRestarting(true)
    setQr(null)
    setPhase('waiting_qr')
    try {
      await api.post('/admin/whatsapp-restart')
      setTimeout(() => startStream(), 1000)
    } catch (err) { setPhase('error') }
    finally { setRestarting(false) }
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-500 rounded-xl">
          <Smartphone size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-gray-500 text-sm">Подключение для отправки уведомлений</p>
        </div>
      </div>

      {/* Статус */}
      <div className={`rounded-xl p-4 mb-5 flex items-center gap-3 border ${
        phase === 'ready' ? 'bg-green-50 border-green-200' :
        phase === 'error' ? 'bg-red-50 border-red-200' :
        'bg-amber-50 border-amber-200'
      }`}>
        {phase === 'ready' && <CheckCircle size={20} className="text-green-600 shrink-0" />}
        {phase === 'error' && <XCircle size={20} className="text-red-600 shrink-0" />}
        {!['ready','error'].includes(phase) && <Wifi size={20} className="text-amber-600 shrink-0 animate-pulse" />}
        <div>
          <p className={`font-semibold text-sm ${
            phase === 'ready' ? 'text-green-800' :
            phase === 'error' ? 'text-red-800' : 'text-amber-800'
          }`}>
            {phase === 'loading' && 'Проверяем статус...'}
            {phase === 'waiting_qr' && 'Ожидание QR кода...'}
            {phase === 'qr' && 'Отсканируйте QR код'}
            {phase === 'authenticated' && 'Авторизация прошла, подключаемся...'}
            {phase === 'ready' && 'WhatsApp подключён ✓'}
            {phase === 'error' && 'Ошибка подключения'}
          </p>
          <p className={`text-xs mt-0.5 ${
            phase === 'ready' ? 'text-green-600' :
            phase === 'error' ? 'text-red-600' : 'text-amber-600'
          }`}>
            {phase === 'ready' && 'Уведомления будут отправляться автоматически'}
            {phase === 'qr' && 'Откройте WhatsApp → Связанные устройства → Привязать устройство'}
            {phase === 'waiting_qr' && 'Запускаем браузер WhatsApp Web, это займёт ~15 сек...'}
            {phase === 'error' && 'Попробуйте перезапустить'}
          </p>
        </div>
      </div>

      {/* QR код */}
      {phase === 'qr' && qr && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center mb-5">
          <p className="text-sm text-gray-500 mb-4 text-center">
            Откройте WhatsApp на телефоне → <strong>Связанные устройства</strong> → <strong>Привязать устройство</strong>
          </p>
          <div className="p-3 bg-white rounded-xl shadow-md border border-gray-100">
            <QRCode value={qr} size={220} />
          </div>
          <p className="text-xs text-gray-400 mt-3">QR действителен ~60 секунд, обновится автоматически</p>
        </div>
      )}

      {/* Ожидание QR */}
      {phase === 'waiting_qr' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center mb-5">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mb-4"></div>
          <p className="text-gray-500 text-sm">Запускаем WhatsApp Web...</p>
        </div>
      )}

      {/* Готово */}
      {phase === 'ready' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center mb-5">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <CheckCircle size={36} className="text-green-500" />
          </div>
          <p className="font-semibold text-gray-800">Подключено!</p>
          <p className="text-sm text-gray-500 mt-1">Сессия сохранена, повторное сканирование не нужно</p>
        </div>
      )}

      {/* Кнопка перезапуска */}
      <button
        onClick={handleRestart}
        disabled={restarting}
        className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 bg-white py-2.5 rounded-xl text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
      >
        <RefreshCw size={16} className={restarting ? 'animate-spin' : ''} />
        {restarting ? 'Перезапуск...' : 'Переподключить WhatsApp'}
      </button>

      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">Как это работает</p>
        <ol className="space-y-1 text-xs text-blue-600 list-decimal list-inside">
          <li>Нажмите "Переподключить" если QR не появился</li>
          <li>Отсканируйте QR телефоном через WhatsApp</li>
          <li>Сессия сохраняется — при перезапуске сервера авторизация не нужна</li>
        </ol>
      </div>
    </div>
  )
}
