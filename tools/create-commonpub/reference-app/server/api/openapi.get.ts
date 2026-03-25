import { generateOpenAPISpec } from '@commonpub/schema';

export default defineEventHandler(() => {
  return generateOpenAPISpec();
});
