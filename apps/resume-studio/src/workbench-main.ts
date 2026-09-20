import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import WorkbenchApp from './WorkbenchApp.vue';
import component from '@/utils/registerCom';
import elementIcons from '@/components/SvgIcon/svgicon';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';
import ColorPicker from 'colorpicker-v3';
import CScrollbar from 'c-scrollbar';
import VueDOMPurifyHTML from 'vue-dompurify-html';
import configDirectives from '@/directives/config';
import { registerStore } from '@/store';
import VueViewer from 'v-viewer';
import contextmenu from 'v-contextmenu';
import UndrawUi from './components/packages/index';
import '@/style/normalize.css';
import '@/assets/font/font.css';
import 'colorpicker-v3/style.css';
import 'element-plus/theme-chalk/src/message.scss';
import 'viewerjs/dist/viewer.css';
import 'v-contextmenu/dist/themes/default.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { template: '<span />' } }]
});

const app = createApp(WorkbenchApp);
app.use(createPinia());
registerStore();
app.use(router);
app.use(component);
app.use(elementIcons);
app.use(ColorPicker);
app.use(CScrollbar);
app.use(configDirectives);
app.use(VueDOMPurifyHTML);
app.use(VueViewer);
app.use(contextmenu);
app.use(UndrawUi);
app.component('SvgIcon', SvgIcon);
app.mount('#app');
