import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import {
  remarkAdmonition,
  remarkAttrList,
  remarkCollapseGroup,
  remarkContentTabs,
  remarkDisableIndentedCode,
  remarkFormatting,
  remarkIcon,
  remarkImageGallery,
  remarkKeys,
} from '~/utils/remark';

export const createDocProcessor = () =>
  unified()
    .use(remarkDisableIndentedCode)
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkContentTabs)
    .use(remarkCollapseGroup)
    .use(remarkAdmonition)
    .use(remarkAttrList)
    .use(remarkImageGallery)
    .use(remarkFormatting)
    .use(remarkKeys)
    .use(remarkIcon);
