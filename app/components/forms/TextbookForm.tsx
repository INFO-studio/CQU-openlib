import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { contributorItems } from '~/components/forms/contributorItems';
import { DRAFT_NOTE_WITH_FILES, FormPage } from '~/components/forms/FormPage';
import { FileInput } from '~/components/ui/file-input';
import { FormChoice, YES_NO_OPTIONS } from '~/components/ui/form-choice';
import { Input } from '~/components/ui/input';
import { useFormDraft } from '~/hooks/useFormDraft';
import { useFormSubmit } from '~/hooks/useFormSubmit';
import {
  CONTRIBUTOR_DEFAULTS,
  type ContributorDraft,
  toContributorPayload,
} from '~/lib/formContributor';
import {
  type FormItemInput,
  question,
  requireChoice,
  requireText,
  section,
} from '~/lib/formItems';
import {
  requireFile,
  type StagingFileRef,
  UPLOAD_HINT,
} from '~/lib/formSubmit';

const YEAR_OPTIONS = [
  { value: '2021', label: '2021' },
  { value: '2022', label: '2022' },
  { value: '2023', label: '2023' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
] as const;

const BOOK_KIND_OPTIONS = [
  { value: '课本', label: '课本' },
  { value: '教材习题解答', label: '教材习题解答' },
  { value: '教辅', label: '教辅' },
  { value: '课外读物', label: '课外读物' },
] as const;

type BookKind = (typeof BOOK_KIND_OPTIONS)[number]['value'];

type BookDraft = {
  name: string;
  kind: '' | BookKind;
  editor: string;
  publisher: string;
  isbn: string;
  hasHd: '' | 'yes' | 'no';
};

type TextbookDraft = {
  year: '' | (typeof YEAR_OPTIONS)[number]['value'];
  college: string;
  major: string;
  course: string;
  courseCode: string;
  bookCount: string;
  books: BookDraft[];
} & ContributorDraft;

const CONTRIBUTOR_OPTS = {
  showAuthorCredit: false,
  showIntro: true,
} as const;

const emptyBook = (): BookDraft => ({
  name: '',
  kind: '',
  editor: '',
  publisher: '',
  isbn: '',
  hasHd: '',
});

const DEFAULTS: TextbookDraft = {
  year: '',
  college: '',
  major: '',
  course: '',
  courseCode: '',
  bookCount: '1',
  books: [emptyBook()],
  ...CONTRIBUTOR_DEFAULTS,
};

const MAX_BOOKS = 8;
const BOOK_COUNT_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
] as const;

const clampCount = (raw: string): number => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_BOOKS, Math.floor(n));
};

const resizeBooks = (books: BookDraft[], count: number): BookDraft[] => {
  const next = books.slice(0, count);
  while (next.length < count) next.push(emptyBook());
  return next;
};

export const TextbookForm = () => {
  const { values, setField, setValues, clear } = useFormDraft({
    slug: 'textbook',
    defaults: DEFAULTS,
  });
  const form = useFormSubmit('textbook');
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [introFile, setIntroFile] = useState<File | null>(null);

  const bookCount = clampCount(values.bookCount);
  const books = useMemo(
    () => resizeBooks(values.books ?? [], bookCount),
    [values.books, bookCount],
  );

  const setContributor = useCallback(
    (patch: Partial<ContributorDraft>) =>
      setValues((prev) => ({ ...prev, ...patch })),
    [setValues],
  );

  const setBookCount = useCallback(
    (raw: string) => {
      const count = clampCount(raw);
      setValues((prev) => ({
        ...prev,
        bookCount: String(count),
        books: resizeBooks(prev.books ?? [], count),
      }));
    },
    [setValues],
  );

  const setBookField = useCallback(
    <K extends keyof BookDraft>(index: number, key: K, value: BookDraft[K]) => {
      setValues((prev) => ({
        ...prev,
        books: resizeBooks(prev.books ?? [], clampCount(prev.bookCount)).map(
          (book, i) => (i === index ? { ...book, [key]: value } : book),
        ),
      }));
    },
    [setValues],
  );

  const bookItems = (book: BookDraft, i: number): FormItemInput[] => {
    const many = books.length > 1;
    const title = many ? `教材 ${i + 1}` : '教材';
    const label = `第 ${i + 1} 本教材`;
    const prefixed = (message: string) =>
      many ? `${label}：${message}` : message;

    return [
      many && section(`book-${i}`, title),

      question({
        key: `book-${i}-name`,
        label: '教材的名称',
        required: true,
        validate: requireText(book.name, prefixed('请填写名称')),
        children: (
          <Input
            value={book.name}
            onChange={(ev) => setBookField(i, 'name', ev.target.value)}
          />
        ),
      }),

      question({
        key: `book-${i}-kind`,
        label: '教材的类型',
        required: true,
        validate: requireChoice(book.kind, prefixed('请选择类型')),
        children: (
          <FormChoice
            value={book.kind}
            options={BOOK_KIND_OPTIONS}
            columns={2}
            onChange={(v) => setBookField(i, 'kind', v)}
            aria-label={`${title}类型`}
          />
        ),
      }),

      question({
        key: `book-${i}-editor`,
        label: '教材的第一位主编',
        required: true,
        hint: '如果是外文书则不是翻译而是「原文主编」。',
        validate: requireText(book.editor, prefixed('请填写第一位主编')),
        children: (
          <Input
            value={book.editor}
            onChange={(ev) => setBookField(i, 'editor', ev.target.value)}
          />
        ),
      }),

      question({
        key: `book-${i}-publisher`,
        label: '教材的出版社',
        required: true,
        validate: requireText(book.publisher, prefixed('请填写出版社')),
        children: (
          <Input
            value={book.publisher}
            onChange={(ev) => setBookField(i, 'publisher', ev.target.value)}
          />
        ),
      }),

      question({
        key: `book-${i}-isbn`,
        label: '教材的 ISBN 号',
        required: true,
        validate: requireText(book.isbn, prefixed('请填写 ISBN')),
        children: (
          <Input
            value={book.isbn}
            onChange={(ev) => setBookField(i, 'isbn', ev.target.value)}
            placeholder="978-…"
            autoComplete="off"
          />
        ),
      }),

      question({
        key: `book-${i}-hasHd`,
        label: '您是否有教材的高清资源',
        required: true,
        validate: () =>
          book.hasHd === 'yes' || book.hasHd === 'no'
            ? null
            : prefixed('请选择是否有高清资源'),
        children: (
          <FormChoice
            value={book.hasHd}
            options={YES_NO_OPTIONS}
            onChange={(v) => setBookField(i, 'hasHd', v)}
            aria-label={`${title}是否有高清资源`}
          />
        ),
      }),

      book.hasHd === 'yes' &&
        question({
          key: `book-${i}-file`,
          label: '上传高清资源文件',
          required: true,
          hint: UPLOAD_HINT,
          validate: requireFile(
            files[i] ?? null,
            prefixed('请上传高清资源文件'),
          ),
          children: (
            <FileInput
              file={files[i] ?? null}
              onChange={(next) => setFiles((prev) => ({ ...prev, [i]: next }))}
            />
          ),
        }),
    ];
  };

  const items: FormItemInput[] = [
    question({
      key: 'year',
      label: '入学学年',
      required: true,
      validate: requireChoice(values.year, '请选择入学学年'),
      children: (
        <FormChoice
          value={values.year}
          options={YEAR_OPTIONS}
          columns={6}
          onChange={(v) => setField('year', v)}
          aria-label="入学学年"
        />
      ),
    }),

    question({
      key: 'college',
      label: '所在学院',
      required: true,
      validate: requireText(values.college, '请填写所在学院'),
      children: (
        <Input
          value={values.college}
          onChange={(ev) => setField('college', ev.target.value)}
          placeholder="如：数学与统计学院"
          autoComplete="organization"
        />
      ),
    }),

    question({
      key: 'major',
      label: '专业名称',
      required: true,
      hint: '如有分支，请包括具体方向。',
      validate: requireText(values.major, '请填写专业名称'),
      children: (
        <Input
          value={values.major}
          onChange={(ev) => setField('major', ev.target.value)}
          placeholder="如：数学与应用数学（师范）"
        />
      ),
    }),

    question({
      key: 'course',
      label: '课程名',
      required: true,
      validate: requireText(values.course, '请填写课程名'),
      children: (
        <Input
          value={values.course}
          onChange={(ev) => setField('course', ev.target.value)}
          placeholder="如：数学分析"
        />
      ),
    }),

    question({
      key: 'courseCode',
      label: '课程代码',
      required: true,
      hint: '格式类似 MATH10821，而非 123456-012。',
      validate: requireText(values.courseCode, '请填写课程代码'),
      children: (
        <Input
          value={values.courseCode}
          onChange={(ev) => setField('courseCode', ev.target.value)}
          placeholder="MATH10821"
          autoComplete="off"
        />
      ),
    }),

    question({
      key: 'bookCount',
      label: '该课程教材数量',
      required: true,
      hint: `最多 ${MAX_BOOKS} 本；更改数量会增减下方教材条目。`,
      children: (
        <FormChoice
          value={values.bookCount}
          options={BOOK_COUNT_OPTIONS}
          columns={4}
          onChange={setBookCount}
          aria-label="该课程教材数量"
        />
      ),
    }),

    ...books.flatMap(bookItems),

    ...contributorItems({
      values,
      onChange: setContributor,
      introFile,
      onIntroFileChange: setIntroFile,
      options: CONTRIBUTOR_OPTS,
    }),
  ];

  const uploadQueue = books.flatMap((book, bookIndex) => {
    const file = files[bookIndex];
    return book.hasHd === 'yes' && file ? [{ bookIndex, file }] : [];
  });
  const withIntroFile = Boolean(values.introKind === 'file' && introFile);
  const uploadFiles: File[] = uploadQueue.map((item) => item.file);
  if (withIntroFile && introFile) uploadFiles.push(introFile);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void form.submit({
      items,
      files: uploadFiles,
      buildPayload: (uploaded) => {
        const byBook = new Map<number, StagingFileRef>();
        uploadQueue.forEach((item, i) => {
          byBook.set(item.bookIndex, uploaded[i]);
        });
        return {
          year: values.year,
          college: values.college.trim(),
          major: values.major.trim(),
          course: values.course.trim(),
          courseCode: values.courseCode.trim(),
          books: books.map((book, i) => ({
            name: book.name.trim(),
            kind: book.kind,
            editor: book.editor.trim(),
            publisher: book.publisher.trim(),
            isbn: book.isbn.trim(),
            hasHd: book.hasHd,
            file: book.hasHd === 'yes' ? byBook.get(i) : undefined,
          })),
          ...toContributorPayload(values, CONTRIBUTOR_OPTS),
          introFile: withIntroFile ? uploaded[uploadQueue.length] : undefined,
        };
      },
      onSuccess: () => {
        clear();
        setFiles({});
        setIntroFile(null);
      },
    });
  };

  return (
    <FormPage
      slug="textbook"
      items={items}
      alert={form.alert}
      showErrors={form.showErrors}
      done={form.done}
      submitting={form.submitting}
      progress={form.progress}
      onSubmit={onSubmit}
      onAgain={form.writeAgain}
      footnote={DRAFT_NOTE_WITH_FILES}
    />
  );
};
