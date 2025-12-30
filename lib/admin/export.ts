/**
 * Admin Export Utilities
 *
 * Provides export functionality for admin data in various formats
 */

export type ExportFormat = 'csv' | 'json' | 'xlsx'

export interface ExportOptions {
  filename?: string
  dateFormat?: string
}

/**
 * Convert data to CSV string
 */
export function toCSV(data: Record<string, unknown>[], columns?: string[]): string {
  if (data.length === 0) return ''

  const cols = columns || Object.keys(data[0])
  const header = cols.join(',')

  const rows = data.map(row => {
    return cols.map(col => {
      const value = row[col]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string') {
        let sanitized = value
        // Prevent CSV injection - prefix dangerous characters with single quote
        if (/^[=+\-@\t\r]/.test(sanitized)) {
          sanitized = "'" + sanitized
        }
        // Escape quotes
        const escaped = sanitized.replace(/"/g, '""')
        // Wrap in quotes if contains comma, newline, or quotes
        const needsQuoting = escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')
        return needsQuoting ? `"${escaped}"` : escaped
      }
      if (value instanceof Date) {
        return value.toISOString()
      }
      return String(value)
    }).join(',')
  })

  return [header, ...rows].join('\n')
}

/**
 * Convert data to JSON string
 */
export function toJSON(data: Record<string, unknown>[]): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Download data as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export data in the specified format
 */
export async function exportData(
  data: Record<string, unknown>[],
  format: ExportFormat,
  options: ExportOptions = {}
): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0]
  const baseFilename = options.filename || `export-${timestamp}`

  switch (format) {
    case 'csv': {
      const csv = toCSV(data)
      downloadFile(csv, `${baseFilename}.csv`, 'text/csv;charset=utf-8;')
      break
    }

    case 'json': {
      const json = toJSON(data)
      downloadFile(json, `${baseFilename}.json`, 'application/json')
      break
    }

    case 'xlsx': {
      // For Excel, we'll dynamically import xlsx library
      try {
        const XLSX = await import('xlsx')
        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
        XLSX.writeFile(workbook, `${baseFilename}.xlsx`)
      } catch (error) {
        console.error('[Export] XLSX export failed:', error)
        // Fallback to CSV
        const csv = toCSV(data)
        downloadFile(csv, `${baseFilename}.csv`, 'text/csv;charset=utf-8;')
      }
      break
    }
  }
}

/**
 * Format payment data for export
 */
export function formatPaymentForExport(payment: {
  id: number
  tbank_payment_id: string
  user_id: number
  telegram_user_id: string
  amount: number
  tier_id: string
  photo_count: number
  status: string
  created_at: string
}): Record<string, unknown> {
  return {
    'ID': payment.id,
    'T-Bank ID': payment.tbank_payment_id,
    'User ID': payment.user_id,
    'Telegram ID': payment.telegram_user_id,
    'Amount': payment.amount,
    'Tier': payment.tier_id,
    'Photos': payment.photo_count,
    'Status': payment.status,
    'Date': new Date(payment.created_at).toLocaleString('ru-RU')
  }
}

/**
 * Format user data for export
 */
export function formatUserForExport(user: {
  id: number
  telegram_user_id: string
  is_pro: boolean
  avatars_count: number
  payments_count: number
  total_spent: number
  created_at: string
}): Record<string, unknown> {
  return {
    'ID': user.id,
    'Telegram ID': user.telegram_user_id,
    'Pro': user.is_pro ? 'Да' : 'Нет',
    'Avatars': user.avatars_count,
    'Payments': user.payments_count,
    'Total Spent': user.total_spent,
    'Registered': new Date(user.created_at).toLocaleString('ru-RU')
  }
}
