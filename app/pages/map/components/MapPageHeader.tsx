import { Dialog } from '@base-ui/react/dialog';
import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import DocLink from '~/components/DocLink';
import { InfoPopover } from '~/components/ui/info-popover';
import { SelectField, type SelectOption } from '~/components/ui/select';
import { CAMPUSES } from '../data';
import type { CampusId } from '../type';

const CAMPUS_OPTIONS: readonly SelectOption<CampusId>[] = CAMPUSES.map(
  (campus) => ({
    value: campus.id,
    label: `${campus.campusName}${campus.siteName}`,
  }),
);

const MapPageHeader = ({
  campusId,
  onCampusChange,
}: {
  campusId: CampusId;
  onCampusChange: (campusId: CampusId) => void;
}) => (
  <header className="relative z-30 flex h-[3.5rem] items-center gap-3 border-b border-line bg-panel px-3 max-md:h-[3.25rem] md:px-4">
    <h1 className="m-0 shrink-0 font-display text-lg font-semibold leading-tight">
      校园地图
    </h1>
    <div className="min-w-0 flex-1">
      <SelectField
        value={campusId}
        options={CAMPUS_OPTIONS}
        onValueChange={onCampusChange}
        ariaLabel="选择校区"
        variant="compact"
        className="max-w-full rounded-md"
      />
    </div>
    <div className="flex shrink-0 items-center gap-1">
      <InfoPopover ariaLabel="查看地图来源信息">
        <p className="m-0 leading-relaxed text-muted">
          本页孵化自{' '}
          <a
            href="https://github.com/littlemana-bot/CQUMAPS"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary no-underline hover:underline"
          >
            CQUMAPS
          </a>
          <span className="mx-1 text-muted">@</span>
          <DocLink
            path="/contributor/Tony"
            className="font-medium text-primary no-underline hover:underline"
          >
            Tony
          </DocLink>
        </p>
        <p className="mt-2 m-0 text-[0.8125rem] leading-relaxed text-muted">
          地点有误、需要修改或补充请通过
          <Link
            to="/form/$type"
            params={{ type: 'feedback' }}
            search={{ page: '/map' }}
            className="mx-1 text-primary no-underline hover:underline"
          >
            问题反馈
          </Link>
          联系我们。
        </p>
      </InfoPopover>
      <Dialog.Trigger
        className="grid h-8 w-8 place-items-center rounded-md text-icon-strong hover:bg-mist md:hidden"
        aria-label="打开地点列表"
      >
        <Menu size={18} />
      </Dialog.Trigger>
    </div>
  </header>
);

export default MapPageHeader;
