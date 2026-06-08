import React, { useState, useEffect } from 'react'
import api from '../api.js'
import { Save, Settings2, CreditCard, Wifi, MessageSquare, CheckCircle } from 'lucide-react'

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-50">
        <Icon size={18} className="text-blue-500" />
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', placeholder = '', hint = '' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function Settings() {
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    try {
      const res = await api.get('/settings')
      setForm(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  function set(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await api.post('/settings', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? 'Сохранено!' : saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>

      <form onSubmit={handleSave}>
        {/* Основное */}
        <Section title="Основное" icon={Settings2}>
          <Field label="Стоимость подписки (₽)" name="subscription_price" value={form.subscription_price || ''} onChange={set} placeholder="250" />
          <Field label="URL сервиса" name="app_url" value={form.app_url || ''} onChange={set} placeholder="https://your-domain.com" hint="Используется в ссылках на оплату в WhatsApp сообщениях" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Время отправки (МСК)</label>
              <input
                type="time"
                name="cron_time"
                value={form.cron_time || '10:00'}
                onChange={set}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Ежедневная проверка подписок</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дней до предупреждения</label>
              <select
                name="notify_days_before"
                value={form.notify_days_before || '1'}
                onChange={set}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">За 1 день</option>
                <option value="2">За 2 дня</option>
                <option value="3">За 3 дня</option>
              </select>
            </div>
          </div>
        </Section>

        {/* СБП реквизиты */}
        <Section title="СБП — реквизиты для оплаты" icon={CreditCard}>
          <p className="text-xs text-gray-500 -mt-1 mb-1">Отображаются на странице оплаты которую получает клиент по ссылке в WhatsApp</p>
          <Field label="Номер телефона СБП" name="sbp_phone" value={form.sbp_phone || ''} onChange={set} placeholder="+79001234567" />
          <Field label="Банк" name="sbp_bank" value={form.sbp_bank || ''} onChange={set} placeholder="Сбербанк" />
          <Field label="Имя получателя" name="sbp_name" value={form.sbp_name || ''} onChange={set} placeholder="Иван И." />
        </Section>

        {/* Способ оплаты */}
        <Section title="Платёжный провайдер (автооплата)" icon={CreditCard}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Провайдер</label>
            <div className="grid grid-cols-3 gap-2">
              {[['platega', 'Platega'], ['yukassa', 'ЮКасса'], ['manual', 'Только вручную']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, payment_provider: val }))}
                  className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    form.payment_provider === val
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.payment_provider === 'platega' && (
            <div className="space-y-3 pt-2 border-t border-gray-50">
              <p className="text-xs text-blue-600 font-medium">Platega</p>
              <Field label="Shop ID" name="platega_shop_id" value={form.platega_shop_id || ''} onChange={set} placeholder="12345" />
              <Field label="Secret Key" name="platega_secret_key" value={form.platega_secret_key || ''} onChange={set} type="password" placeholder="sk_live_..." />
              <Field label="Webhook URL" name="platega_webhook_url" value={form.platega_webhook_url || ''} onChange={set} placeholder="https://your-domain.com/api/payments/webhook" hint="Вставить в настройках Platega" />
            </div>
          )}

          {form.payment_provider === 'yukassa' && (
            <div className="space-y-3 pt-2 border-t border-gray-50">
              <p className="text-xs text-purple-600 font-medium">ЮКасса</p>
              <Field label="Shop ID" name="yukassa_shop_id" value={form.yukassa_shop_id || ''} onChange={set} placeholder="123456" />
              <Field label="Secret Key" name="yukassa_secret_key" value={form.yukassa_secret_key || ''} onChange={set} type="password" placeholder="test_..." />
            </div>
          )}

          {form.payment_provider === 'manual' && (
            <div className="pt-2 border-t border-gray-50">
              <p className="text-sm text-gray-500">Платежи подтверждаются вручную через кнопку на карточке клиента.</p>
            </div>
          )}
        </Section>

        {/* WireGuard Easy */}
        <Section title="WireGuard Easy" icon={Wifi}>
          <Field label="URL сервера" name="wg_easy_url" value={form.wg_easy_url || ''} onChange={set} placeholder="http://localhost:51821" />
          <Field label="Пароль" name="wg_easy_password" value={form.wg_easy_password || ''} onChange={set} type="password" placeholder="••••••••" />
        </Section>

        {/* Шаблоны сообщений */}
        <Section title="Шаблоны WhatsApp сообщений" icon={MessageSquare}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Напоминание об оплате</label>
            <textarea
              name="reminder_message"
              value={form.reminder_message || ''}
              onChange={set}
              rows={3}
              placeholder="Оставьте пустым для стандартного сообщения"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Переменные: {'{name}'}, {'{price}'}, {'{date}'}, {'{link}'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Уведомление об отключении</label>
            <textarea
              name="expired_message"
              value={form.expired_message || ''}
              onChange={set}
              rows={3}
              placeholder="Оставьте пустым для стандартного сообщения"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Подтверждение оплаты</label>
            <textarea
              name="activated_message"
              value={form.activated_message || ''}
              onChange={set}
              rows={3}
              placeholder="Оставьте пустым для стандартного сообщения"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </Section>
      </form>
    </div>
  )
}
