import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

export default defineConfig({
  site: 'https://caishaodong.pages.dev',
  integrations: [
    mermaid(),
    starlight({
      title: '蔡少东',
      description: '分享技术文章和学习心得的个人博客',
      sidebar: [
        {
          label: '首页',
          items: [{ label: '欢迎', link: '/' }],
        },
        {
          label: '博客文章',
          items: [
            { label: '所有文章', link: '/blog' },
            { label: 'DeepAgents 使用指南', link: '/blog/deepagents-usage-guide' },
            { label: 'LangGraph 中间件系统指南', link: '/blog/langgraph-middleware-guide' },
            { label: 'Milvus 向量数据库使用指南', link: '/blog/milvus-usage-guide' },
            { label: 'RAG 重排序的必要性', link: '/blog/rag-reranking-necessity' },
            { label: 'IntelliJ IDEA 插件推荐', link: '/blog/idea-plugins' },
            { label: 'PowerShell Get-Verb', link: '/blog/get-verb' },
          ],
        },
        {
          label: '环境管理',
          items: [
            { label: 'Dotenvx', link: '/dotenvx' },
            { label: '使用指南', link: '/dotenvx/guide' },
          ],
        },
        {
          label: 'API 网关',
          items: [
            { label: 'Kong', link: '/kong' },
            { label: '最少连接分析', link: '/kong/least-connections-analysis' },
          ],
        },
        {
          label: '系统编程',
          items: [
            { label: 'Rust', link: '/rust' },
          ],
        },
        {
          label: '开发工具',
          items: [
            { label: '工具', link: '/tools' },
          ],
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
