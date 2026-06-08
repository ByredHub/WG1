import React, { useEffect, useRef } from 'react'

export default function QRCode({ value, size = 200 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!value || !canvasRef.current) return

    // Загружаем qrcode library через CDN или используем простую реализацию
    import('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
      .catch(() => null)
      .then(async () => {
        if (window.QRCode) {
          await window.QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 })
        }
      })
  }, [value, size])

  // Fallback: используем API для генерации QR как картинки
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`

  return (
    <img
      src={qrUrl}
      alt="QR Code"
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
