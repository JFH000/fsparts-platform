import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@fsparts/core'
import { useAuthModal } from '../modules/auth/composables/useAuthModal'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                  name: 'landing',            component: () => import('../modules/landing/views/LandingView.vue') },
    { path: '/catalog',           name: 'catalog',             component: () => import('../modules/catalog/views/CatalogView.vue') },
    { path: '/product/:id',       name: 'product-detail',      component: () => import('../modules/catalog/views/ProductDetailView.vue') },
    { path: '/cart',              name: 'cart',                component: () => import('../modules/cart/views/CartView.vue') },
    { path: '/checkout',          name: 'checkout',            component: () => import('../modules/cart/views/CheckoutView.vue'), meta: { requiresUser: true } },
    { path: '/pedido-confirmado', name: 'order-confirmation',  component: () => import('../modules/orders/views/OrderConfirmationView.vue'), meta: { requiresUser: true } },
    { path: '/orders',            name: 'orders',              component: () => import('../modules/orders/views/OrdersView.vue'), meta: { requiresUser: true } },
    { path: '/orders/:id',        name: 'order-detail',        component: () => import('../modules/orders/views/OrderDetailView.vue'), meta: { requiresUser: true } },
  ],

  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.isReady) await authStore.init()

  if (to.meta.requiresUser) {
    if (!authStore.isAuthenticated) {
      const { open } = useAuthModal()
      open('login')
      return false
    }
  }

  return true
})

export default router
