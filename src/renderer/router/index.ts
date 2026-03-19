import { createRouter, createWebHashHistory } from 'vue-router'
import Main from '@/components/Main.vue'
import TaskIndex from '@/components/Task/Index.vue'
import PreferenceIndex from '@/components/Preference/Index.vue'
import PreferenceSubnav from '@/components/Subnav/PreferenceSubnav.vue'
import PreferenceBasic from '@/components/Preference/Basic.vue'
import PreferenceAdvanced from '@/components/Preference/Advanced.vue'
import PreferenceLab from '@/components/Preference/Lab.vue'

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
          component: PreferenceIndex,
          props: true,
          children: [
            {
              path: 'basic',
              alias: '',
              components: {
                subnav: PreferenceSubnav,
                form: PreferenceBasic,
              },
              props: {
                subnav: { current: 'basic' },
              },
            },
            {
              path: 'advanced',
              components: {
                subnav: PreferenceSubnav,
                form: PreferenceAdvanced,
              },
              props: {
                subnav: { current: 'advanced' },
              },
            },
            {
              path: 'lab',
              components: {
                subnav: PreferenceSubnav,
                form: PreferenceLab,
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
