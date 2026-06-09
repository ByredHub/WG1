import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

export default function Pay() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    axios.get(`/api/pay/${token}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [token])

  function copyPhone() {
    navigator.clipboard.writeText(data.sbpPhone)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handlePaid() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await axios.post(`/api/pay/${token}/request`)
      setSubmitted(true)
    } catch (e) {
      setSubmitError(e.response?.data?.error || 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  // Генерируем СБП deeplink (Сбербанк / универсальный)
  function getSbpLink() {
    if (!data?.sbpPhone) return null
    const phone = data.sbpPhone.replace(/\D/g, '')
    const amount = data.price
    // Универсальный формат СБП
    return `https://qr.nspk.ru/AS100003YLS8BSXUODQWM?type=02&bank=100000000111&sum=${amount}00&cur=RUB&crc=AB45`
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Ссылка недействительна</h1>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    </div>
  )

  const { client, price, sbpPhone, sbpBank, sbpName } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white text-center">
          <div className="text-4xl mb-3">📡</div>
          <h1 className="text-xl font-bold">Оплата VPN</h1>
          <p className="text-blue-200 text-sm mt-1">Привет, {client.name}!</p>
        </div>

        <div className="p-6">
          {/* Сумма */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-center">
            <p className="text-sm text-gray-500 mb-1">Сумма к оплате</p>
            <p className="text-4xl font-bold text-gray-900">{price}<span className="text-2xl">₽</span></p>
            <p className="text-xs text-gray-400 mt-1">подписка на 1 месяц</p>
          </div>

          {/* СБП кнопка */}
          {sbpPhone ? (
            <div className="space-y-3">
              {/* Большая кнопка СБП */}
              <button
                onClick={copyPhone}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl py-4 font-bold text-lg flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
              >
                <span className="text-2xl">💳</span>
                {copied ? 'Номер скопирован!' : 'Оплатить по СБП'}
              </button>

              {/* Инструкция */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Как оплатить:</p>
                <ol className="text-sm text-blue-700 space-y-1.5">
                  <li className="flex gap-2"><span className="font-bold shrink-0">1.</span>Нажмите кнопку — номер скопируется</li>
                  <li className="flex gap-2"><span className="font-bold shrink-0">2.</span>Откройте банковское приложение → СБП → По номеру телефона</li>
                  <li className="flex gap-2"><span className="font-bold shrink-0">3.</span>Вставьте номер и переведите <strong>{price}₽</strong></li>
                  <li className="flex gap-2"><span className="font-bold shrink-0">4.</span>VPN продлится автоматически</li>
                </ol>
              </div>

              {/* Реквизиты */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Номер телефона</span>
                  <button onClick={copyPhone} className="text-sm font-mono font-bold text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors">
                    {sbpPhone}
                  </button>
                </div>
                {sbpBank && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Банк</span>
                    <span className="text-sm font-medium text-gray-900">{sbpBank}</span>
                  </div>
                )}
                {sbpName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Получатель</span>
                    <span className="text-sm font-medium text-gray-900">{sbpName}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              <p className="text-sm">Реквизиты для оплаты скоро появятся.</p>
              <p className="text-xs mt-1">Свяжитесь с администратором.</p>
            </div>
          )}

          {/* Кнопка «Я оплатил» */}
          {submitted ? (
            <div className="mt-5 bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="font-bold text-green-800 text-base">Заявка отправлена!</p>
              <p className="text-green-700 text-sm mt-1">Мы проверим платёж и активируем VPN.<br/>Ответ придёт в WhatsApp.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              <button
                onClick={handlePaid}
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl py-3.5 font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {submitting ? (
                  <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Отправка...</>
                ) : (
                  <><span>✅</span> Я оплатил</>
                )}
              </button>
              {submitError && <p className="text-red-500 text-xs text-center">{submitError}</p>}
              <p className="text-xs text-gray-400 text-center">Нажмите после перевода — мы проверим и активируем VPN</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
