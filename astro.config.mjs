import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

export default defineConfig({
  site: 'https://caishaodong.pages.dev',
  integrations: [
    mermaid(),
    starlight({
      title: 'wilson-x',
      description: '分享技术文章和学习心得的个人博客',
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'application/rss+xml',
            title: 'wilson-x 技术博客',
            href: '/rss.xml',
          },
        },
      ],
      sidebar: [
        {
          label: '首页',
          items: [{ label: '欢迎', link: '/' }],
        },
        {
          label: 'AI 与 LLM',
          autogenerate: { directory: 'ai' },
        },
        {
          label: 'API 网关',
          autogenerate: { directory: 'api-gateway' },
        },
        {
          label: '开发工具',
          autogenerate: { directory: 'dev-tools' },
        },
        {
          label: '系统编程',
          autogenerate: { directory: 'system-programming' },
        },
        {
          label: '关于',
          items: [
            { label: '关于我', link: '/about' },
          ],
        },
      ],
      locales: {
        root: {
          label: '简体中文',
          lang: 'zh-CN',
        },
      },
      defaultLocale: 'root',
    }),
  ],
});
