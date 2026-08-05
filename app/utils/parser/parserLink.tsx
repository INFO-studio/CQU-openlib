import DocLink from '~/components/DocLink';
import { TextLink } from '~/components/ui/link';
import { useDocBase } from '~/contexts/DocBaseContext';
import { trackItemClick } from '~/lib/analytics';
import { classifyDownload } from '~/lib/analyticsDownload';
import type { MnLink } from '~/types/mdast';
import { mdastText } from '~/utils/mdastText';
import { resolveDocHref } from '~/utils/normalizeDocHref';
import parser from '~/utils/parser/index';

const isExternal = (href: string) => {
  if (!href) return false;
  if (
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  ) {
    return true;
  }
  return false;
};

/** Static files under /doc — must not go through SPA DocLink. */
const isStaticAsset = (href: string) => {
  if (href.startsWith('/doc/')) return true;
  const path = href.split(/[?#]/)[0] ?? '';
  return /\.(?:png|jpe?g|gif|webp|svg|pdf|zip|rar|7z|mp[34]|wav|docx?|xlsx?|pptx?|txt|csv|md|mdx)$/i.test(
    path,
  );
};

const ParserLink = ({ mn }: { mn: MnLink }) => {
  const base = useDocBase();
  const href = resolveDocHref(mn.url || '', base);
  const children = mn.children.map(parser);
  const download =
    mn.download === true ? true : mn.download ? mn.download : undefined;
  const className = mn.className
    ? `text-primary no-underline hover:underline ${mn.className}`
    : 'text-primary no-underline hover:underline';

  if (download !== undefined || isStaticAsset(href) || isExternal(href)) {
    // Null for plain hyperlinks, so a link to a GitHub repo or a video stays
    // uncounted while a link that hands over a file does not.
    const asDownload = classifyDownload(href, download !== undefined);
    return (
      <TextLink
        href={href}
        className={className}
        download={download === true ? '' : download}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noreferrer' : undefined}
        onClick={
          asDownload
            ? () =>
                trackItemClick({
                  item_type: 'download',
                  ...asDownload,
                  text: mdastText(mn.children) || undefined,
                })
            : undefined
        }
      >
        {children}
      </TextLink>
    );
  }
  if (href.startsWith('#')) {
    return (
      <TextLink href={href} className={className}>
        {children}
      </TextLink>
    );
  }
  return (
    <DocLink path={href} className={className}>
      {children}
    </DocLink>
  );
};
const parserLink = (mn: MnLink) => <ParserLink mn={mn} />;
export default parserLink;
