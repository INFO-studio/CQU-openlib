import {
  DynamicIcon,
  dynamicIconImports,
  type IconName,
} from 'lucide-react/dynamic';
import type { MnIcon } from '~/types/mdast';

const parserIcon = (mn: MnIcon) =>
  Object.keys(dynamicIconImports).includes(mn.icon) ? (
    <DynamicIcon name={mn.icon as IconName} size={'1lh'} />
  ) : (
    <div>unknown icon {mn.icon}</div>
  );
export default parserIcon;
