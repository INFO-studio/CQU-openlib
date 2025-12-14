import parse from 'html-react-parser';
import type { MnHtml } from '~/types/mdast';

const parserHtml = (mn: MnHtml) => <>{parse(mn.value)}</>;
export default parserHtml;
