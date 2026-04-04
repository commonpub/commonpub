<script setup lang="ts">
import ExplainerViewer from '../vue/components/ExplainerViewer.vue';

type BlockTuple = [string, Record<string, unknown>];

const sampleContent = {
  title: 'Understanding Neural Networks',
  description: 'An interactive guide to how artificial neurons learn',
  coverImageUrl: 'https://picsum.photos/1200/400',
  content: [
    // Section 1
    ['sectionHeader', { tag: '§ 01', title: 'The Biological Inspiration', body: 'How real neurons inspired artificial ones.' }],
    ['text', { html: '<p>The human brain contains roughly <strong>86 billion neurons</strong>, each connected to thousands of others. These biological networks process information through electrical and chemical signals.</p>' }],
    ['text', { html: '<p>Artificial neural networks are a simplified mathematical model of this biological process. Each artificial neuron receives inputs, applies weights, and produces an output.</p>' }],
    ['callout', { variant: 'info', html: '<p>Neural networks were first proposed in 1943 by Warren McCulloch and Walter Pitts.</p>' }],
    ['checkpoint', { label: 'You understand the biological inspiration' }],

    // Section 2
    ['sectionHeader', { tag: '§ 02', title: 'Weights and Biases', body: 'The parameters that make learning possible.' }],
    ['text', { html: '<p>Every connection between neurons has a <strong>weight</strong> — a number that determines how much influence one neuron has on another. During training, these weights are adjusted to minimize error.</p>' }],
    ['interactiveSlider', {
      label: 'Weight Value',
      min: -2,
      max: 2,
      step: 0.1,
      unit: '',
      defaultValue: 0.5,
      feedback: [
        { min: -2, max: -0.5, state: 'low', message: 'Negative weights inhibit the signal — the neuron actively suppresses this input.' },
        { min: -0.5, max: 0.5, state: 'ok', message: 'Near-zero weights mean this input has little influence on the output.' },
        { min: 0.5, max: 2, state: 'good', message: 'Strong positive weight — this input strongly activates the neuron.' },
      ],
    }],
    ['text', { html: '<p>A <strong>bias</strong> is an additional parameter that shifts the activation threshold. Think of it as how "easily" a neuron fires.</p>' }],

    // Section 3
    ['sectionHeader', { tag: '§ 03', title: 'Activation Functions', body: 'Adding non-linearity to the model.' }],
    ['text', { html: '<p>Without activation functions, a neural network would just be a linear transformation — no matter how many layers you add. Activation functions introduce <em>non-linearity</em>, allowing networks to learn complex patterns.</p>' }],
    ['code', { language: 'python', code: 'import numpy as np\n\ndef relu(x):\n    """Rectified Linear Unit"""\n    return np.maximum(0, x)\n\ndef sigmoid(x):\n    """Maps any value to (0, 1)"""\n    return 1 / (1 + np.exp(-x))' }],
    ['quiz', {
      question: 'Why are activation functions necessary in neural networks?',
      options: [
        { text: 'To speed up training', correct: false },
        { text: 'To introduce non-linearity so the network can learn complex patterns', correct: true },
        { text: 'To reduce the number of parameters', correct: false },
        { text: 'To prevent overfitting', correct: false },
      ],
    }],

    // Section 4
    ['sectionHeader', { tag: '§ 04', title: 'Putting It Together', body: 'From inputs to predictions.' }],
    ['text', { html: '<p>A complete neural network chains these concepts together: inputs flow through layers of neurons, each applying weights, biases, and activation functions. The final layer produces the prediction.</p>' }],
    ['callout', { variant: 'tip', html: '<p>The key insight: a network with enough neurons and layers can approximate <strong>any</strong> continuous function. This is the Universal Approximation Theorem.</p>' }],
    ['text', { html: '<p>In practice, modern networks have millions or billions of parameters, trained on massive datasets using gradient descent.</p>' }],
    ['checkpoint', { label: 'You understand the building blocks of neural networks' }],
  ] as BlockTuple[],
  author: {
    displayName: 'Dr. Ada Network',
    username: 'adanet',
    avatarUrl: null,
  },
  publishedAt: '2026-03-15T10:00:00Z',
  createdAt: '2026-03-10T08:00:00Z',
};
</script>

<template>
  <Story title="Composites/ExplainerViewer" group="composites" :layout="{ type: 'single', iframe: true }">
    <Variant title="Full Explainer">
      <ExplainerViewer
        :content="sampleContent"
        :on-edit="() => console.log('Edit clicked')"
      />
    </Variant>
  </Story>
</template>
