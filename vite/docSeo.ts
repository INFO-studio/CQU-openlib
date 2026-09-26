import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { parseDocument } from 'yaml';
import { FORM_META, FORM_SLUGS } from '../app/lib/formTypes';
import { NAV_SECTIONS, titleFromPath } from '../app/lib/nav';
import {
  canonicalUrl,
  defaultDescription,
  formatTitle,
  SITE_ORIGIN,
} from '../app/lib/pageMeta';

type Frontmatter = {
  title?: string | null;
  description?: string;
  updated?: string;
};

type RouteMeta = {
  path: string;
  title: string | null;
  description: string;
  updated?: string;
  noindex?: boolean;
};

const frontmatterPattern = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const parseFrontmatter = (source: string): Frontmatter => {
  const yaml = source.match(frontmatterPattern)?.[1];
  if (!yaml) return {};
  const parsed = parseDocument(yaml);
  if (parsed.errors.length) throw new Error(parsed.errors[0]?.message);
  const value = parsed.toJS({ maxAliasCount: 0 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  return {
    title:
      data.title === null || typeof data.title === 'string'
        ? data.title
        : undefined,
    description:
      typeof data.description === 'string' ? data.description : undefined,
    updated: typeof data.updated === 'string' ? data.updated : undefined,
  };
};

const walkMarkdown = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(file);
    return /\.mdx?$/i.test(entry.name) ? [file] : [];
  });

const routeFromFile = (docRoot: string, file: string): string => {
  const rel = relative(docRoot, file).replace(/\\/g, '/');
  if (rel === 'index.md') return '/';
  if (rel.endsWith('/index.md')) return `/${rel.slice(0, -'/index.md'.length)}`;
  return `/${rel.replace(/\.mdx?$/i, '')}`;
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!,
  );

export const renderRouteHtml = (template: string, meta: RouteMeta): string => {
  const title = formatTitle(meta.title);
  const canonical = canonicalUrl(meta.path);
  const robots = meta.noindex ? 'noindex, nofollow' : 'index, follow';
  const head = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    '<meta name="twitter:card" content="summary" />',
  ].join('\n    ');
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/i,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    )
    .replace('</head>', `    ${head}\n  </head>`);
};

const writeRoute = (outDir: string, html: string, path: string): void => {
  const file =
    path === '/'
      ? join(outDir, 'index.html')
      : join(outDir, path.slice(1), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html, 'utf8');
};

const malformedPathRecovery = `
    <script>
      (() => {
        const decode = (value, remaining = 3) => {
          if (remaining <= 0) return value;
          try {
            const next = decodeURIComponent(value);
            return next === value ? value : decode(next, remaining - 1);
          } catch { return value; }
        };
        const canonical = encodeURI(decode(location.pathname));
        if (canonical !== location.pathname) {
          location.replace(canonical + location.search + location.hash);
        }
      })();
    </script>
`;

export const docSeoPlugin = (): Plugin => {
  const state = { root: process.cwd(), outDir: 'build/client' };
  return {
    name: 'doc-seo',
    configResolved(config) {
      state.root = config.root;
      state.outDir = config.build.outDir;
    },
    closeBundle() {
      const output = join(state.root, state.outDir);
      const templateFile = join(output, 'index.html');
      const docRoot = join(state.root, 'public', 'doc');
      if (!existsSync(templateFile)) return;
      const template = readFileSync(templateFile, 'utf8');
      const routes: RouteMeta[] = walkMarkdown(docRoot).map((file) => {
        const path = routeFromFile(docRoot, file);
        const frontmatter = parseFrontmatter(readFileSync(file, 'utf8'));
        const sectionTitle = NAV_SECTIONS.find(
          (section) => section.path === path,
        )?.label;
        const fallbackTitle =
          path === '/'
            ? null
            : (sectionTitle ?? titleFromPath(relative(docRoot, file)));
        const title =
          frontmatter.title === undefined ? fallbackTitle : frontmatter.title;
        return {
          path,
          title,
          description: frontmatter.description ?? defaultDescription(title),
          updated: frontmatter.updated,
          noindex: path === '/42' || path.startsWith('/42/'),
        };
      });

      const appRoutes: RouteMeta[] = [
        {
          path: '/map',
          title: '校园地图',
          description:
            '重庆大学各校区教学楼、宿舍、食堂、快递点与公共设施地图。',
        },
        {
          path: '/academic/graduation',
          title: '毕业去向',
          description:
            '查询重庆大学历届毕业生按院系、学历、届次和去向类别汇总的毕业去向。',
        },
        ...FORM_SLUGS.map((slug) => ({
          path: `/form/${slug}`,
          title: FORM_META[slug].title,
          description: FORM_META[slug].description,
          noindex: true,
        })),
        {
          path: '/admin',
          title: '维护台',
          description: 'CQU-openlib 维护台。',
          noindex: true,
        },
        {
          path: '/admin/emails',
          title: '邮件往来',
          description: 'CQU-openlib 邮件维护台。',
          noindex: true,
        },
        {
          path: '/admin/file-failures',
          title: '直链监控',
          description: 'CQU-openlib 直链监控。',
          noindex: true,
        },
      ];

      [...routes, ...appRoutes].forEach((meta) => {
        writeRoute(output, renderRouteHtml(template, meta), meta.path);
      });

      const sitemapRoutes = routes.filter((route) => !route.noindex);
      sitemapRoutes.push(...appRoutes.filter((route) => !route.noindex));
      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...sitemapRoutes.map(
          (route) =>
            `  <url><loc>${escapeHtml(canonicalUrl(route.path))}</loc>${
              route.updated ? `<lastmod>${route.updated}</lastmod>` : ''
            }</url>`,
        ),
        '</urlset>',
        '',
      ].join('\n');
      writeFileSync(join(output, 'sitemap.xml'), sitemap, 'utf8');
      writeFileSync(
        join(output, 'robots.txt'),
        `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /42\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
        'utf8',
      );

      const notFound = renderRouteHtml(template, {
        path: '/404',
        title: '未找到页面',
        description: '没有找到对应的 CQU-openlib 页面。',
        noindex: true,
      }).replace('</head>', `${malformedPathRecovery}  </head>`);
      writeFileSync(join(output, '404.html'), notFound, 'utf8');
    },
  };
};
