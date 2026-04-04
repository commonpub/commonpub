<script setup lang="ts">
import SliderBlock from '../vue/components/blocks/SliderBlock.vue';
</script>

<template>
  <Story title="Blocks/SliderBlock" group="blocks">
    <Variant title="With Feedback Ranges">
      <SliderBlock
        :content="{
          label: 'CPU Clock Speed',
          min: 1,
          max: 5,
          step: 0.1,
          unit: ' GHz',
          defaultValue: 2.5,
          feedback: [
            { min: 1, max: 2, state: 'low', message: 'Below 2 GHz — this will feel sluggish for modern workloads.' },
            { min: 2, max: 3.5, state: 'good', message: 'The sweet spot for most tasks. Good balance of performance and power.' },
            { min: 3.5, max: 5, state: 'high', message: 'High performance, but watch out for thermal throttling and power draw.' },
          ],
        }"
      />
    </Variant>

    <Variant title="Simple (No Feedback)">
      <SliderBlock
        :content="{
          label: 'Opacity',
          min: 0,
          max: 100,
          step: 1,
          unit: '%',
          defaultValue: 50,
        }"
      />
    </Variant>

    <Variant title="Fine-Grained Steps">
      <SliderBlock
        :content="{
          label: 'Learning Rate',
          min: 0.0001,
          max: 0.01,
          step: 0.0001,
          defaultValue: 0.001,
          feedback: [
            { min: 0.0001, max: 0.0005, state: 'low', message: 'Very slow convergence. Training may take too long.' },
            { min: 0.0005, max: 0.003, state: 'good', message: 'Standard range. Most models train well here.' },
            { min: 0.003, max: 0.01, state: 'danger', message: 'Risk of overshooting. Loss may oscillate or diverge.' },
          ],
        }"
      />
    </Variant>
  </Story>
</template>
