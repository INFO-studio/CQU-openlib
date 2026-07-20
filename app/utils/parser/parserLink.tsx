import DocLink from '~/components/DocLink';
import { TextLink } from '~/components/ui/link';
import { useDocBase } from '~/contexts/DocBaseContext';
import type { MnLink } from '~/types/mdast';
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
const ParserLink = ({ mn }: { mn: MnLink }) => {
  const base = useDocBase();
  const href = resolveDocHref(mn.url || '', base);
  const children = mn.children.map(parser);
  if (isExternal(href)) {
    return (
      <TextLink
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noreferrer' : undefined}
      >
        {children}
      </TextLink>
    );
  }
  if (href.startsWith('#')) {
    return <TextLink href={href}>{children}</TextLink>;
  }
  return (
    <DocLink path={href} className="text-primary no-underline hover:underline">
      {children}
    </DocLink>
  );
};
const parserLink = (mn: MnLink) => <ParserLink mn={mn} />;
export default parserLink;
