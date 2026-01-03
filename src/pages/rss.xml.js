import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';

// 手动读取文件 frontmatter 中的 pubDate
function getPubDateFromFileSync(id) {
  try {
    const filePath = path.join(process.cwd(), 'src', 'content', 'docs', id);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(fileContent);
    if (data.pubDate) {
      return new Date(data.pubDate);
    }
  } catch (e) {
    console.error(`Error reading pubDate for ${id}:`, e.message);
  }
  return null;
}

export async function GET(context) {
  const posts = await getCollection('docs');

  // 过滤：排除首页、关于页、索引页
  const articles = posts.filter(post => {
    const slug = post.slug;
    return !slug.startsWith('index') &&
           !slug.startsWith('about') &&
           !slug.endsWith('/index') &&
           !/^ai$|^api-gateway$|^dev-tools$|^system-programming$|^api-gateway\/higress$|^api-gateway\/kong$|^dev-tools\/dotenvx$|^system-programming\/rust$|^dev-tools\/tools$/.test(slug);
  }).map(post => {
    // 尝试从文件直接读取 pubDate
    const pubDateFromFile = getPubDateFromFileSync(post.id);
    return {
      ...post,
      pubDate: pubDateFromFile || post.data.pubDate || new Date(),
    };
  }).sort((a, b) => {
    const aDate = a.pubDate?.valueOf() || 0;
    const bDate = b.pubDate?.valueOf() || 0;
    return bDate - aDate;
  });

  return rss({
    title: 'wilson-x 技术博客',
    description: '分享技术文章和学习心得的个人博客',
    site: context.site,
    items: articles.map(post => ({
      title: post.data.title,
      description: post.data.description || '',
      pubDate: post.pubDate,
      link: `/${post.slug}/`,
    })),
    customData: `<language>zh-CN</language>`,
  });
}
