import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  schema: docsSchema({
    extend: (context) => z.object({
      // 扩展 Starlight schema，添加 pubDate 字段
      pubDate: z.coerce.date().optional(),
    }),
  }),
});

export const collections = { docs };
