<template>
  <span>
    <span class="error">{{error}}</span>
    <progress :class="error ? 'progress-bar error' : 'progress-bar'" :value="percent" max="100">{{percent}}</progress>
  </span>
</template>
<style scoped>
   .progress-bar {
    display: block;
    height: 50px;
    width: 300px;
    background-color: #ced3cc;
    border-radius: 10px;
  }
  .error {
    color: #b24a4a;
  }
  .progress-bar.error::-webkit-progress-bar {
    background-color: #b24a4a;
  }
  /*
  .progress-bar::after {
    content: attr(value);
  }*/
  .progress-bar::-webkit-progress-bar{
    background-color: #ced3cc;
    border-radius: 10px;
  }
  .progress-bar[value]::-webkit-progress-value {
    background-color: #6cc4bd;
    border-radius: 10px;
  }

  .progressjs-theme-blueOverlayRadiusWithPercentBar {
    background-color: #ced3cc;
  }

  .progressjs-theme-blueOverlayRadiusWithPercentBar .progressjs-inner {
    background-color: #6cc4bd;
  }
</style>
<script>
  module.exports = {
    props: ['percent', 'error']
  }
</script>