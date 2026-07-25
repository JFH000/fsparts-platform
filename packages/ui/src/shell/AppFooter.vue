<template>
  <footer class="bg-slate-900 text-slate-400">
    <div class="mx-auto max-w-7xl px-4 py-12 md:py-16">
      <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
        <!-- Brand -->
        <div class="sm:col-span-2 lg:col-span-2">
          <div class="flex items-center gap-2">
            <img :src="logoUrl" alt="" class="h-8 w-8 object-contain flex-shrink-0" />
            <span class="text-lg font-semibold text-white">{{ companyName }}</span>
          </div>
          <p class="mt-4 max-w-sm text-sm leading-relaxed">{{ description }}</p>
          <ul class="mt-6 flex items-center gap-3">
            <li v-for="social in socialLinks" :key="social.icon">
              <a
                :href="social.href"
                :aria-label="social.label"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-all hover:-translate-y-0.5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path :d="SOCIAL_ICON_PATHS[social.icon]" />
                </svg>
              </a>
            </li>
          </ul>
        </div>

        <!-- Quick links -->
        <nav aria-label="Enlaces rápidos">
          <h2 class="text-sm font-semibold text-white">Enlaces rápidos</h2>
          <ul class="mt-4 space-y-3">
            <li v-for="link in quickLinks" :key="link.label">
              <a :href="link.href" class="text-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 rounded-sm">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </nav>

        <!-- Contact -->
        <div>
          <h2 class="text-sm font-semibold text-white">Contacto</h2>
          <address class="mt-4 space-y-3 text-sm not-italic">
            <a :href="`mailto:${email}`" class="flex items-center gap-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 rounded-sm">
              <Mail class="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {{ email }}
            </a>
            <a :href="`tel:${phoneHref}`" class="flex items-center gap-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 rounded-sm">
              <Phone class="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {{ phone }}
            </a>
            <p v-if="address" data-testid="footer-address" class="flex items-start gap-2">
              <MapPin class="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{{ address }}</span>
            </p>
          </address>
        </div>

        <!-- Newsletter -->
        <div>
          <h2 class="text-sm font-semibold text-white">Newsletter</h2>
          <p class="mt-4 text-sm">Novedades y ofertas, directo a tu correo.</p>
          <form class="mt-4 flex gap-2" @submit.prevent="handleSubscribe">
            <label for="footer-newsletter-email" class="sr-only">Correo electrónico</label>
            <input
              id="footer-newsletter-email"
              v-model="newsletterEmail"
              type="email"
              required
              placeholder="tu@correo.com"
              class="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              aria-label="Suscribirse"
              class="flex-shrink-0 flex items-center justify-center rounded-lg bg-brand-700 px-3 py-2 text-white transition-colors hover:bg-brand-600 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Send class="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="mt-10 flex flex-col items-center gap-4 border-t border-slate-800 pt-6 sm:flex-row sm:justify-between">
        <div class="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
          <p class="text-xs">&copy; {{ year }} {{ companyName }}. Todos los derechos reservados.</p>
          <ul class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <li v-for="link in legalLinks" :key="link.label">
              <a :href="link.href" class="text-xs transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 rounded-sm">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
        <button
          type="button"
          aria-label="Volver arriba"
          class="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 rounded-sm"
          @click="scrollToTop"
        >
          Volver arriba
          <ArrowUp class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Mail, Phone, MapPin, Send, ArrowUp } from '@lucide/vue'
import logoUrl from '../assets/logo.png'

interface FooterLink {
  label: string
  href: string
}

interface SocialLink {
  label: string
  href: string
  icon: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'github'
}

interface Props {
  companyName?: string
  description?: string
  email?: string
  phone?: string
  address?: string
  quickLinks?: FooterLink[]
  legalLinks?: FooterLink[]
  socialLinks?: SocialLink[]
}

const {
  companyName = 'FSP Parts',
  description = 'Distribuidor especializado de repuestos HVAC/R — Colombia',
  email = 'contacto@fsparts.org',
  phone = '+57 300 000 0000',
  address,
  quickLinks = [
    { label: 'Inicio', href: '#' },
    { label: 'Servicios', href: '#' },
    { label: 'Nosotros', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Contacto', href: '#' },
  ],
  legalLinks = [
    { label: 'Política de privacidad', href: '#' },
    { label: 'Términos y condiciones', href: '#' },
    { label: 'Cookies', href: '#' },
  ],
  socialLinks = [
    { label: 'Facebook', href: '#', icon: 'facebook' },
    { label: 'Instagram', href: '#', icon: 'instagram' },
    { label: 'LinkedIn', href: '#', icon: 'linkedin' },
    { label: 'X', href: '#', icon: 'x' },
    { label: 'GitHub', href: '#', icon: 'github' },
  ],
} = defineProps<Props>()

const emit = defineEmits<{ subscribe: [email: string] }>()

const phoneHref = computed(() => phone.replace(/[^\d+]/g, ''))
const year = computed(() => new Date().getFullYear())

const newsletterEmail = ref('')
function handleSubscribe() {
  emit('subscribe', newsletterEmail.value)
  newsletterEmail.value = ''
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const SOCIAL_ICON_PATHS: Record<SocialLink['icon'], string> = {
  facebook: 'M22.675 0h-21.35C.6 0 0 .6 0 1.326v21.348C0 23.4.6 24 1.326 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.4 24 24 23.4 24 22.674V1.326C24 .6 23.4 0 22.675 0z',
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
}
</script>
