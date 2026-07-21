export const FORM_SLUGS = ['feedback', 'textbook', 'upload', 'club'] as const;

export type FormSlug = (typeof FORM_SLUGS)[number];

/** API `type` field */
export type FormApiType = 'feedback' | 'textbook' | 'upload' | 'club';

export const isFormSlug = (value: string): value is FormSlug =>
  (FORM_SLUGS as readonly string[]).includes(value);

export const slugToApiType = (slug: FormSlug): FormApiType => slug;

export const FORM_META: Record<
  FormSlug,
  { title: string; description: string }
> = {
  feedback: {
    title: '页面反馈表单',
    description: '我们会认真聆听并对您的反馈作出适当的变化。',
  },
  textbook: {
    title: '教材收集表',
    description:
      '告知某门课程需要的教材、习题解答或教辅。有高清资源时可直接上传文件。',
  },
  upload: {
    title: '文件上传',
    description:
      '贡献教材、试卷、课件、笔记或其他课程相关文件。选择文件后，将在提交时上传。',
  },
  club: {
    title: '社团信息表单',
    description: '社长或管理人员提交社团信息更正与补充。',
  },
};
