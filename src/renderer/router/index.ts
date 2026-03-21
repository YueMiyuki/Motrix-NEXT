import { createRouter, createWebHashHistory } from 'vue-router'
import Main from '@/components/Main.vue'
import TaskIndex from '@/components/Task/Index.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'main',
      component: Main,
      children: [
        {
          path: '/task',
          alias: '/',
          component: TaskIndex,
          props: {
            status: 'active',
          },
        },
        {
          path: '/task/:status',
          name: 'task',
          component: TaskIndex,
          props: true,
        },
        {
          path: '/preference',
          name: 'preference',
          component: () => import('@/components/Preference/Index.vue'),
          props: true,
          children: [
            {
              path: 'basic',
              alias: '',
              components: {
                subnav: () => import('@/components/Subnav/PreferenceSubnav.vue'),
                form: () => import('@/components/Preference/Basic.vue'),
              },
              props: {
                subnav: { current: 'basic' },
              },
            },
            {
              path: 'advanced',
              components: {
                subnav: () => import('@/components/Subnav/PreferenceSubnav.vue'),
                form: () => import('@/components/Preference/Advanced.vue'),
              },
              props: {
                subnav: { current: 'advanced' },
              },
            },
            {
              path: 'lab',
              components: {
                subnav: () => import('@/components/Subnav/PreferenceSubnav.vue'),
                form: () => import('@/components/Preference/Lab.vue'),
              },
              props: {
                subnav: { current: 'lab' },
              },
            },
          ],
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})
