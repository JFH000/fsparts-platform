import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'hvac-calculator', component: () => import('../modules/hvac/views/HvacCalculatorView.vue') },
  ],
})

export default router
