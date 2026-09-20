<template>
  <teleport to="body">
    <div class="template-mask" @mousedown.self="emit('close')">
      <section class="template-dialog" role="dialog" aria-modal="true" aria-label="切换简历模板">
        <header>
          <div><span>专业模板</span><h2>选择简历版式</h2><p>只切换排版与视觉样式，不会删除已填写内容。</p></div>
          <button type="button" class="close" aria-label="关闭" @click="emit('close')">×</button>
        </header>
        <div class="filters">
          <button v-for="item in filters" :key="item.value" type="button" :class="{ active: filter === item.value }" @click="filter = item.value">{{ item.label }}</button>
        </div>
        <div class="templates">
          <button v-for="item in filteredTemplates" :key="item.index" type="button" class="template-card" @click="choose(item.index)">
            <div class="preview" :class="item.layout"><i></i><b></b><span></span><span></span><span></span></div>
            <div><strong>{{ item.name }}</strong><small>{{ item.layout === 'leftRight' ? '双栏布局' : '专业单栏' }}</small></div>
          </button>
        </div>
      </section>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { cloneDeep } from 'lodash';
import { ElMessage } from 'element-plus';
import appStore from '@/store';
import { applyWorkbenchTemplate, workbenchTemplatePresets, saveWorkbenchResume } from './resumeBridge';

const emit = defineEmits(['close']);
const filter = ref('all');
const filters = [{ label: '全部模板', value: 'all' }, { label: '专业单栏', value: 'classical' }, { label: '双栏布局', value: 'leftRight' }];
const templates = workbenchTemplatePresets.map((item: any, index: number) => ({ ...item, index }));
const filteredTemplates = computed(() => filter.value === 'all' ? templates : templates.filter((item: any) => item.layout === filter.value));

const choose = (index: number) => {
  const current = appStore.useResumeJsonNewStore.resumeJsonNewStore;
  const next = applyWorkbenchTemplate(cloneDeep(current), index);
  appStore.useResumeJsonNewStore.changeResumeJsonData(next);
  appStore.useUuidStore.setUuid();
  saveWorkbenchResume(next, next.ID);
  window.parent.postMessage({ type: 'JOB_WORKBENCH_STUDIO_CHANGE', resume: cloneDeep(next), savedAt: new Date().toISOString() }, '*');
  ElMessage.success('模板已切换，简历内容已保留');
  emit('close');
};
</script>

<style scoped lang="scss">
.template-mask{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;padding:28px;background:rgba(15,35,53,.48);backdrop-filter:blur(6px)}
.template-dialog{width:min(980px,94vw);max-height:88vh;overflow:hidden;background:#fff;border:1px solid #dce7e7;border-radius:24px;box-shadow:0 28px 80px rgba(18,42,61,.22);display:flex;flex-direction:column}
header{display:flex;justify-content:space-between;gap:24px;padding:28px 30px 22px;border-bottom:1px solid #e5ecef}header span{font-size:13px;color:#008e88;font-weight:700}h2{margin:5px 0 6px;font-size:26px;color:#16314b}p{margin:0;color:#718399}.close{width:38px;height:38px;border:1px solid #dce6ea;border-radius:50%;background:#fff;color:#6f8092;font-size:28px;line-height:32px;cursor:pointer}
.filters{display:flex;gap:8px;padding:18px 30px 4px}.filters button{height:36px;padding:0 16px;border:1px solid #dce6e8;border-radius:10px;background:#fff;color:#5f7184;cursor:pointer}.filters button.active{background:#e6f7f5;border-color:#9edbd6;color:#008d86;font-weight:700}
.templates{padding:18px 30px 30px;overflow:auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.template-card{text-align:left;border:1px solid #dce6e8;border-radius:16px;background:#fff;padding:12px;cursor:pointer;transition:.18s}.template-card:hover{border-color:#26a9a2;transform:translateY(-2px);box-shadow:0 10px 25px rgba(27,113,110,.12)}.template-card strong,.template-card small{display:block}.template-card strong{margin-top:10px;color:#17334d}.template-card small{margin-top:3px;color:#8998a8}
.preview{height:160px;border-radius:9px;background:#f4f7f8;padding:20px;display:grid;grid-template-columns:1fr;align-content:start;gap:10px}.preview.leftRight{grid-template-columns:34% 1fr}.preview i{height:25px;background:#159b94;border-radius:4px}.preview b,.preview span{height:7px;background:#b9c7ce;border-radius:4px}.preview.leftRight i{grid-row:1/5;height:120px}.preview span:nth-of-type(2){width:76%}.preview span:nth-of-type(3){width:55%}
@media(max-width:760px){.templates{grid-template-columns:repeat(2,1fr)}.template-dialog{border-radius:18px}}
</style>
