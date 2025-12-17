/**
 * Error utilities for handling API responses
 * Extracts human-readable error messages from various API error formats
 */

/**
 * Извлекает сообщение об ошибке из API response
 * Поддерживает форматы:
 * - { error: "message" }                       - строка
 * - { error: { message: "..." } }              - объект с message
 * - { error: { code: "...", message: "..." } } - объект из api-utils
 * - { message: "..." }                         - прямое сообщение
 *
 * @param apiResponse - Response body от API
 * @param fallback - Fallback сообщение если ничего не найдено
 * @returns Human-readable error message
 */
export function extractErrorMessage(
  apiResponse: unknown,
  fallback = "Unknown error"
): string {
  if (!apiResponse) return fallback

  // Если это строка - вернуть как есть
  if (typeof apiResponse === "string") return apiResponse

  // Если это не объект - stringify
  if (typeof apiResponse !== "object") return String(apiResponse)

  const resp = apiResponse as Record<string, unknown>

  // Формат: { error: "message" } или { error: { ... } }
  const error = resp.error
  if (error) {
    if (typeof error === "string") return error
    if (typeof error === "object" && error !== null) {
      const errObj = error as Record<string, unknown>
      // Приоритет: message > code > stringify
      if (typeof errObj.message === "string") return errObj.message
      if (typeof errObj.code === "string") return errObj.code
      return JSON.stringify(error)
    }
  }

  // Формат: { message: "..." }
  if (typeof resp.message === "string") return resp.message

  // Fallback
  return fallback
}

/**
 * Безопасно извлекает сообщение из любого типа ошибки
 * Для использования в catch блоках
 *
 * @param error - Error объект или что угодно из catch
 * @param fallback - Fallback сообщение
 * @returns Human-readable error message
 */
export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  // Стандартный Error класс
  if (error instanceof Error) {
    return error.message || fallback
  }

  // Объект (возможно API response)
  if (error && typeof error === "object") {
    return extractErrorMessage(error, fallback)
  }

  // Строка
  if (typeof error === "string") {
    return error || fallback
  }

  // Все остальное
  return fallback
}
