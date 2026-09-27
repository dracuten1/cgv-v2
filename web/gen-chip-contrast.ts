import { createApp, h } from 'vue';
import AppChip from './src/components/ui/AppChip.vue';
import './src/assets/main.css';

// Isolated real-component fixture; no auth or backend required.
createApp({
  render: () => h('div', ['gen1', 'gen2', 'gen3', 'gen4'].map(variant =>
    h(AppChip, { variant, 'data-generation': variant }, () => `Đời ${variant.slice(-1)}`),
  )),
}).mount('#app');
