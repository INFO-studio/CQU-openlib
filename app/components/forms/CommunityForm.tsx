import type { ReactNode } from 'react';
import DocsShell from '~/components/DocsShell';
import { ClubForm } from '~/components/forms/ClubForm';
import { FeedbackForm } from '~/components/forms/FeedbackForm';
import { FormBackButton } from '~/components/forms/FormBackButton';
import { GroupForm } from '~/components/forms/GroupForm';
import { TextbookForm } from '~/components/forms/TextbookForm';
import { UploadForm } from '~/components/forms/UploadForm';
import type { FormSlug } from '~/lib/formTypes';

type Props = {
  type: FormSlug;
  initialPage?: string;
};

export const CommunityForm = ({ type, initialPage = '' }: Props) => {
  const bySlug: Record<FormSlug, ReactNode> = {
    feedback: <FeedbackForm initialPage={initialPage} />,
    textbook: <TextbookForm />,
    upload: <UploadForm />,
    club: <ClubForm />,
    group: <GroupForm />,
  };

  return <DocsShell leftRail={<FormBackButton />}>{bySlug[type]}</DocsShell>;
};
