import { Kbd } from '~/components/ui/kbd';
import type { MnKbd } from '~/types/mdast';

const parserKbd = (mn: MnKbd) => <Kbd keys={mn.keys} />;

export default parserKbd;
