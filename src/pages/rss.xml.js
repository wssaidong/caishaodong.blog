import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('docs');

  // 过滤：排除首页、关于页、索引页
  const articles = posts.filter(post => {
    const slug = post.slug;

    // 排除条件：
    // 1. 首页和关于页
    // 2. 索引页（slug 包含 index 或是已知的分类索引）
    return !slug.startsWith('index') &&
           !slug.startsWith('about') &&
           !slug.endsWith('/index') &&
           // 排除分类目录的索引文件
           !/^ai$|^api-gateway$|^dev-tools$|^system-programming$|^api-gateway\/higress$|^api-gateway\/kong$|^dev-tools\/dotenvx$|^system-programming\/rust$|^dev-tools\/tools$/.test(slug);
  }).sort((a, b) => {
    // 有 pubDate 的按日期降序排序，没有的放在后面
    const aDate = a.data.pubDate?.valueOf() || 0;
    const bDate = b.data.pubDate?.valueOf() || 0;
    if (aDate && bDate) return bDate - aDate;
    if (aDate) return -1;
    if (bDate) return 1;
    return 0;
  });

  return rss({
    title: 'wilson-x 技术博客',
    description: '分享技术文章和学习心得的个人博客',
    site: context.site,
    items: articles.map(post => ({
      title: post.data.title,
      description: post.data.description || '',
      pubDate: post.data.pubDate || new Date(),
      link: `/${post.slug}/`,
    })),
    customData: `<language>zh-CN</language>`,
  });
}
