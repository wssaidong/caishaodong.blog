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
          items: [
            { label: '所有文章', link: '/ai' },
            { label: 'DeepAgents 使用指南', link: '/ai/deepagents-usage-guide' },
            { label: 'LangGraph 中间件系统指南', link: '/ai/langgraph-middleware-guide' },
            { label: 'Milvus 向量数据库使用指南', link: '/ai/milvus-usage-guide' },
            { label: 'RAG 重排序的必要性', link: '/ai/rag-reranking-necessity' },
            { label: 'IntelliJ IDEA 插件推荐', link: '/ai/idea-plugins' },
            { label: 'PowerShell Get-Verb', link: '/ai/get-verb' },
          ],
        },
        {
          label: 'API 网关',
          items: [
            { label: '所有文章', link: '/api-gateway' },
            { label: 'Higress', link: '/api-gateway/higress' },
            { label: '部署运维指南', link: '/api-gateway/higress/higress-operation-guide' },
            { label: '配置参数参考', link: '/api-gateway/higress/higress-values-reference' },
            { label: '多实例部署', link: '/api-gateway/higress/higress-multi-instance-deployment' },
            { label: '多数据面入门', link: '/api-gateway/higress/higress-multi-dataplane-quickstart' },
            { label: 'Pilot 原理', link: '/api-gateway/higress/higress-pilot-working-principle' },
            { label: '数据面控制机制', link: '/api-gateway/higress/console-数据面控制机制分析' },
            { label: '资源存储机制', link: '/api-gateway/higress/higress-k8s-resource-storage' },
            { label: 'Gateway API 指南', link: '/api-gateway/higress/higress-gateway-crd-guide' },
            { label: 'REST API 指南', link: '/api-gateway/higress/higress-rest-api-guide' },
            { label: 'Admin SDK 指南', link: '/api-gateway/higress/higress-admin-sdk-guide' },
            { label: '插件服务器', link: '/api-gateway/higress/higress-plugin-server-guide' },
            { label: '自定义插件部署', link: '/api-gateway/higress/higress-custom-plugin-deployment-guide' },
            { label: '多集群路由', link: '/api-gateway/higress/higress-multi-cluster-routing' },
            { label: 'Kong', link: '/api-gateway/kong' },
            { label: '最少连接分析', link: '/api-gateway/kong/least-connections-analysis' },
          ],
        },
        {
          label: '开发工具',
          items: [
            { label: '所有文章', link: '/dev-tools' },
            { label: 'Dotenvx', link: '/dev-tools/dotenvx' },
            { label: '使用指南', link: '/dev-tools/dotenvx/guide' },
            { label: '工具', link: '/dev-tools/tools' },
            { label: 'Vibe Kanban', link: '/dev-tools/vibe-kanban' },
          ],
        },
        {
          label: '系统编程',
          items: [
            { label: '所有文章', link: '/system-programming' },
            { label: 'Rust', link: '/system-programming/rust' },
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
