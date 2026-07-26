import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import faviconUrl from '@fsparts/ui/assets/logo.png'

const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
if (favicon) {
  favicon.type = 'image/png'
  favicon.href = faviconUrl
}

createApp(App).use(createPinia()).use(router).mount('#app')
