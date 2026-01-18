import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  schema: docsSchema({
    extend: (context) => z.object({
      // 扩展 Starlight schema，添加 SEO 相关字段

      // 发布日期
      pubDate: z.coerce.date().optional(),

      // 文章特色图片（用于社交媒体分享）
      image: z.string().optional(),

      // 文章标签（用于分类和SEO）
      tags: z.array(z.string()).optional(),

      // SEO关键词（用于meta keywords）
      keywords: z.array(z.string()).optional(),

      // 作者信息
      author: z.string().optional(),

      // 文章摘要（用于description，如果为空则使用description）
      excerpt: z.string().optional(),

      // 规范链接（用于处理重复内容）
      canonical: z.string().url().optional(),
    }),
  }),
});

export const collections = { docs };
