<template>
  <el-config-provider size="default" :locale="zhCn">
    <Designer />
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import Designer from '@/views/designer/index.vue';
</script>

<style>
html, body, #app { width: 100%; height: 100%; margin: 0; }
body { background: #f4f7f8; color: #15324b; }
</style>
