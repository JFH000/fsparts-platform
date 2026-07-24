import { reactive } from 'vue'

type Toast = {
  id: string
  message: string
  href?: string
  linkLabel?: string
  duration?: number
}

const toasts = reactive<Toast[]>([])

export function useToast() {
  function add(opts: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID()
    toasts.push({ id, ...opts })
    setTimeout(() => dismiss(id), opts.duration ?? 6000)
  }

  function dismiss(id: string) {
    const i = toasts.findIndex(t => t.id === id)
    if (i !== -1) toasts.splice(i, 1)
  }

  return { toasts, add, dismiss }
}
