import type { Processor } from 'unified';

type MicromarkDisable = {
  disable?: {
    null?: string[];
  };
};
/**
 * MkDocs content often indents list items with 4 spaces.
 * CommonMark treats that as indented code — disable it.
 */
export default function remarkDisableIndentedCode(this: Processor) {
  const data = this.data() as {
    micromarkExtensions?: MicromarkDisable[];
  };
  const list = data.micromarkExtensions ?? [];
  list.push({ disable: { null: ['codeIndented'] } });
  data.micromarkExtensions = list;
}
