<script setup lang="ts">
import CheckpointBlock from '../vue/components/blocks/CheckpointBlock.vue';
</script>

<template>
  <Story title="Blocks/CheckpointBlock" group="blocks">
    <Variant title="Default">
      <CheckpointBlock :content="{ label: 'Checkpoint reached' }" @reached="() => console.log('Checkpoint!')" />
    </Variant>

    <Variant title="Custom Label">
      <CheckpointBlock :content="{ label: 'You now understand the basics of gradient descent' }" @reached="() => {}" />
    </Variant>
  </Story>
</template>
