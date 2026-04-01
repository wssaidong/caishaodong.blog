import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://caishaodong.pages.dev',
  integrations: [
    mermaid(),
    sitemap(),
    starlight({
      title: 'Wilson 技术博客 | 云原生与 AI 技术实践',
      description: '专注于云原生架构与 AI 技术的深度技术博客，涵盖 Higress 网关、Kubernetes、LangGraph、RAG 系统、API 网关架构设计等实战技术文章',
      head: [
        // 网站图标
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            href: '/favicon.svg',
            type: 'image/svg+xml',
          },
        },
        // RSS 订阅
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'application/rss+xml',
            title: 'Wilson 技术博客 RSS',
            href: '/rss.xml',
          },
        },
        // 作者信息
        {
          tag: 'meta',
          attrs: {
            name: 'author',
            content: '蔡少东 (Wilson)',
          },
        },
        // 关键词
        {
          tag: 'meta',
          attrs: {
            name: 'keywords',
            content: '云原生,API网关,Higress,Kubernetes,Linux,LangGraph,AI,LLM,RAG,DeepAgents,技术博客,架构设计',
          },
        },
        // Open Graph - Facebook/LinkedIn 分享优化
        {
          tag: 'meta',
          attrs: {
            property: 'og:type',
            content: 'website',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:site_name',
            content: 'Wilson 技术博客',
          },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:locale',
            content: 'zh_CN',
          },
        },
        // Twitter Card - Twitter 分享优化
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:card',
            content: 'summary_large_image',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:creator',
            content: '@wssaidong',
          },
        },
        // 结构化数据 - JSON-LD
        {
          tag: 'script',
          attrs: {
            type: 'application/ld+json',
          },
          content: `{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "name": "Wilson 技术博客",
                "url": "https://caishaodong.pages.dev",
                "description": "专注于云原生架构与 AI 技术的深度技术博客",
                "inLanguage": "zh-CN",
                "publisher": {
                  "@type": "Person",
                  "name": "蔡少东",
                  "alternateName": "Wilson",
                  "url": "https://github.com/wssaidong"
                }
              },
              {
                "@type": "Person",
                "name": "蔡少东",
                "alternateName": "Wilson",
                "jobTitle": "云原生架构与 AI 技术实践者",
                "url": "https://caishaodong.pages.dev/about",
                "sameAs": [
                  "https://github.com/wssaidong"
                ],
                "knowsAbout": [
                  "云原生架构",
                  "API网关",
                  "Higress",
                  "Kubernetes",
                  "LangGraph",
                  "RAG系统",
                  "AI/LLM"
                ]
              },
              {
                "@type": "Organization",
                "name": "Wilson 技术博客",
                "url": "https://caishaodong.pages.dev",
                "logo": "https://caishaodong.pages.dev/favicon.svg"
              }
            ]
          }`,
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
          label: 'Kubernetes',
          autogenerate: { directory: 'kubernetes' },
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
      head: [
        // ... existing head items ...
        // 自定义页脚
        {
          tag: 'style',
          content: `
            .custom-footer {
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              color: #fff;
              padding: 1.5rem 2rem;
              text-align: center;
              border-top: 1px solid rgba(255,255,255,0.1);
              margin-top: 2rem;
            }
            .custom-footer a {
              color: #60a5fa;
              text-decoration: none;
              margin: 0 1rem;
              transition: color 0.3s;
            }
            .custom-footer a:hover {
              color: #93c5fd;
            }
          `,
        },
        {
          tag: 'script',
          content: `
            document.addEventListener('DOMContentLoaded', function() {
              var footer = document.createElement('footer');
              footer.className = 'custom-footer';
              footer.innerHTML = '📎 其他项目：<a href="https://x-json.pages.dev" target="_blank">x-json.pages.dev</a> | <a href="https://github.com/wssaidong" target="_blank">GitHub</a>';
              document.body.appendChild(footer);
            });
          `,
        },
      ],
    }),
  ],
});
