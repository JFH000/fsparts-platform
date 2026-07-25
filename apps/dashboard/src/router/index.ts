import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/products' },
    { path: '/products',          name: 'admin-products',     component: () => import('../modules/admin/views/AdminProductsView.vue') },
    { path: '/products/new',      name: 'admin-product-new',  component: () => import('../modules/admin/views/AdminProductFormView.vue') },
    { path: '/products/:id/edit', name: 'admin-product-edit', component: () => import('../modules/admin/views/AdminProductFormView.vue') },
    { path: '/catalog',           name: 'admin-catalog',      component: () => import('../modules/admin/views/AdminCatalogView.vue') },
    { path: '/customers',         name: 'admin-customers',    component: () => import('../modules/admin/views/AdminCustomersView.vue') },
    { path: '/sales',             name: 'admin-sales',        component: () => import('../modules/admin/views/AdminSalesView.vue') },
  ],
})

export default router
