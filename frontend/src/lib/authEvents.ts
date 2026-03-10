export const AUTH_REQUIRED_EVENT = 'envpilot:auth-required'

export function isAuthFailureMessage(message?: string): boolean {
  return typeof message === 'string' && message.includes('主密码')
}

export function emitAuthRequired(message?: string) {
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, {
    detail: { message },
  }))
}

export function notifyAuthFailure(message?: string) {
  if (isAuthFailureMessage(message)) {
    emitAuthRequired(message)
  }
}