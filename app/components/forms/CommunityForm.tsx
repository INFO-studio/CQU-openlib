import { Link } from '@tanstack/react-router';
import DocsShell from '~/components/DocsShell';
import { ClubForm } from '~/components/forms/ClubForm';
import { FeedbackForm } from '~/components/forms/FeedbackForm';
import { FormBackButton } from '~/components/forms/FormBackButton';
import { TextbookForm } from '~/components/forms/TextbookForm';
import { UploadForm } from '~/components/forms/UploadForm';
import type { FormSlug } from '~/lib/formTypes';

type Props = {
  type: FormSlug;
  initialPage?: string;
};

export const CommunityForm = ({ type, initialPage = '' }: Props) => {
  const leftRail = <FormBackButton />;

  if (type === 'feedback') {
    return (
      <DocsShell leftRail={leftRail}>
        <FeedbackForm initialPage={initialPage} />
      </DocsShell>
    );
  }

  if (type === 'textbook') {
    return (
      <DocsShell leftRail={leftRail}>
        <TextbookForm />
      </DocsShell>
    );
  }

  if (type === 'upload') {
    return (
      <DocsShell leftRail={leftRail}>
        <UploadForm />
      </DocsShell>
    );
  }

  if (type === 'club') {
    return (
      <DocsShell leftRail={leftRail}>
        <ClubForm />
      </DocsShell>
    );
  }

  return (
    <DocsShell leftRail={leftRail}>
      <p className="text-sm text-muted">
        未知表单。返回
        <Link
          to="/form/$type"
          params={{ type: 'feedback' }}
          className="mx-1 text-primary underline-offset-2 hover:underline"
        >
          反馈表
        </Link>
        。
      </p>
    </DocsShell>
  );
};
