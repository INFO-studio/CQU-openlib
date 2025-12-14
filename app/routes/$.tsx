import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Mn } from '~/types/mdast';
import parser from '~/utils/parser';
import preprocess from '~/utils/preprocess';
import {
  remarkAdmonition,
  remarkFormatting,
  remarkIcon,
  removePosition,
} from '~/utils/remark';

export function meta() {
  return [
    { title: 'CQU-openlib' },
    { name: 'description', content: 'CQU-openlib' },
  ];
}

export default function Page() {
  const params = useParams();
  const page = params['*']?.split('.md')[0] ?? 'index';
  console.log(page);
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkAdmonition)
    .use(remarkFormatting)
    .use(remarkIcon);
  const [file, setFile] = useState<Mn | null>(null);
  const [status, setStatus] = useState<'not found' | 'ok' | 'pending'>(
    'pending',
  );

  useEffect(() => {
    (async () => {
      const fetchResult = await fetch(`/doc/${page}.md`);
      if (
        fetchResult.status === 404 ||
        fetchResult.headers.get('content-type') === 'text/html'
      ) {
        setStatus('not found');
        return;
      }
      const value = await fetchResult.text();
      const preprocessed = preprocess(value || '');
      const parsed = processor.parse(preprocessed);
      const file = removePosition((await processor.run(parsed)) as Mn);
      setFile(file);
      setStatus('ok');
    })();
  }, [processor.parse, processor.run, page]);

  if (status === 'not found') {
    return <div>404 not found</div>;
  }
  if (status === 'pending') return <div>Loading...</div>;
  if (!file) {
    return <div>Empty file</div>;
  }

  return (
    <div className={'flex'}>
      <div className={'flex-1'}>{parser(file)}</div>
      <pre className={'flex-1'}>
        <code>{JSON.stringify(file, null, 2)}</code>
      </pre>
    </div>
  );
}
