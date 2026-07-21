import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { FormDone } from '~/components/forms/FormDone';
import { FormError } from '~/components/forms/FormError';
import { FormQuestion } from '~/components/forms/FormQuestion';
import { FormShell } from '~/components/forms/FormShell';
import { FormStack } from '~/components/forms/FormStack';
import { SubmitProgressOverlay } from '~/components/forms/SubmitProgressOverlay';
import { Button } from '~/components/ui/button';
import { FileInput } from '~/components/ui/file-input';
import { FormChoice, YES_NO_OPTIONS } from '~/components/ui/form-choice';
import { Input } from '~/components/ui/input';
import { useFormDraft } from '~/hooks/useFormDraft';
import {
  type StagingFileRef,
  type UploadProgress,
  IDLE_UPLOAD_PROGRESS,
  submitFormWithFiles,
} from '~/lib/formSubmit';

const TITLE = '教材收集表';
const LEDE =
  '告知某门课程需要的教材、习题解答或教辅。有高清资源时可直接上传文件。';

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
};

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
};

const MAX_BOOKS = 8;
const padIndex = (n: number) => String(n).padStart(2, '0');

const resizeBooks = (books: BookDraft[], count: number): BookDraft[] => {
  const next = books.slice(0, count);
  while (next.length < count) next.push(emptyBook());
  return next;
};

const IDLE_PROGRESS = IDLE_UPLOAD_PROGRESS;

export const TextbookForm = () => {
  const { values, setField, setValues, clear } = useFormDraft({
    slug: 'textbook',
    defaults: DEFAULTS,
  });
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>(IDLE_PROGRESS);

  const bookCount = useMemo(() => {
    const n = Number.parseInt(values.bookCount, 10);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(MAX_BOOKS, n);
  }, [values.bookCount]);

  const books = useMemo(
    () => resizeBooks(values.books ?? [], bookCount),
    [values.books, bookCount],
  );

  const bookQuestionStarts = useMemo(() => {
    const starts: number[] = [];
    let next = 7;
    for (const book of books) {
      starts.push(next);
      next += 6 + (book.hasHd === 'yes' ? 1 : 0);
    }
    return starts;
  }, [books]);

  const setBookCount = useCallback(
    (raw: string) => {
      const n = Number.parseInt(raw, 10);
      const count =
        !Number.isFinite(n) || n < 1 ? 1 : Math.min(MAX_BOOKS, Math.floor(n));
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
      setValues((prev) => {
        const nextBooks = resizeBooks(prev.books ?? [], bookCount).map(
          (book, i) => (i === index ? { ...book, [key]: value } : book),
        );
        return { ...prev, books: nextBooks };
      });
    },
    [bookCount, setValues],
  );

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!values.year) {
      setError('请选择入学学年');
      return;
    }
    if (!values.college.trim()) {
      setError('请填写所在学院');
      return;
    }
    if (!values.major.trim()) {
      setError('请填写专业名称');
      return;
    }
    if (!values.course.trim()) {
      setError('请填写课程名');
      return;
    }
    if (!values.courseCode.trim()) {
      setError('请填写课程代码');
      return;
    }

    const uploadQueue: { bookIndex: number; file: File }[] = [];

    for (let i = 0; i < books.length; i += 1) {
      const book = books[i];
      const label = `第 ${i + 1} 本教材`;
      if (!book.name.trim()) {
        setError(`${label}：请填写名称`);
        return;
      }
      if (!book.kind) {
        setError(`${label}：请选择类型`);
        return;
      }
      if (!book.editor.trim()) {
        setError(`${label}：请填写第一位主编`);
        return;
      }
      if (!book.publisher.trim()) {
        setError(`${label}：请填写出版社`);
        return;
      }
      if (!book.isbn.trim()) {
        setError(`${label}：请填写 ISBN`);
        return;
      }
      if (book.hasHd !== 'yes' && book.hasHd !== 'no') {
        setError(`${label}：请选择是否有高清资源`);
        return;
      }
      if (book.hasHd === 'yes') {
        const file = files[i];
        if (!file) {
          setError(`${label}：请上传高清资源文件`);
          return;
        }
        uploadQueue.push({ bookIndex: i, file });
      }
    }

    setSubmitting(true);
    setProgress(
      uploadQueue.length
        ? {
            phase: 'upload',
            fileIndex: 1,
            fileTotal: uploadQueue.length,
          }
        : IDLE_UPLOAD_PROGRESS,
    );

    try {
      await submitFormWithFiles({
        type: 'textbook',
        files: uploadQueue.map((item) => item.file),
        onProgress: setProgress,
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
          };
        },
      });
      clear();
      setFiles({});
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
      setProgress(IDLE_PROGRESS);
    }
  };

  if (done) {
    return (
      <FormDone title={TITLE} lede={LEDE} onAgain={() => setDone(false)} />
    );
  }

  return (
    <FormShell title={TITLE} lede={LEDE}>
      <SubmitProgressOverlay open={submitting} progress={progress} />
      <FormStack onSubmit={onSubmit}>
        <FormQuestion index="01" label="入学学年" required>
          <FormChoice
            value={values.year}
            options={YEAR_OPTIONS}
            columns={6}
            onChange={(v) => setField('year', v)}
            aria-label="入学学年"
          />
        </FormQuestion>

        <FormQuestion index="02" label="所在学院" required>
          <Input
            value={values.college}
            onChange={(ev) => setField('college', ev.target.value)}
            placeholder="如：数学与统计学院"
            autoComplete="organization"
          />
        </FormQuestion>

        <FormQuestion
          index="03"
          label="专业名称"
          required
          hint="如有分支，请包括具体方向。"
        >
          <Input
            value={values.major}
            onChange={(ev) => setField('major', ev.target.value)}
            placeholder="如：数学与应用数学（师范）"
          />
        </FormQuestion>

        <FormQuestion index="04" label="课程名" required>
          <Input
            value={values.course}
            onChange={(ev) => setField('course', ev.target.value)}
            placeholder="如：数学分析"
          />
        </FormQuestion>

        <FormQuestion
          index="05"
          label="课程代码"
          required
          hint="格式类似 MATH10821，而非 123456-012。"
        >
          <Input
            value={values.courseCode}
            onChange={(ev) => setField('courseCode', ev.target.value)}
            placeholder="MATH10821"
            autoComplete="off"
          />
        </FormQuestion>

        <FormQuestion
          index="06"
          label="该课程教材数量"
          required
          hint={`最多 ${MAX_BOOKS} 本；更改数量会增减下方教材条目。`}
        >
          <Input
            type="number"
            min={1}
            max={MAX_BOOKS}
            value={values.bookCount}
            onChange={(ev) => setBookCount(ev.target.value)}
          />
        </FormQuestion>

        {books.map((book, i) => {
          const start = bookQuestionStarts[i] ?? 7;
          const title = books.length > 1 ? `教材 ${i + 1}` : '教材';
          return (
            <div key={i} className="flex flex-col gap-7">
              {books.length > 1 ? (
                <p className="mt-1 border-t border-line pt-4 font-display text-lg font-semibold text-ink">
                  {title}
                </p>
              ) : null}

              <FormQuestion index={padIndex(start)} label="教材的名称" required>
                <Input
                  value={book.name}
                  onChange={(ev) => setBookField(i, 'name', ev.target.value)}
                />
              </FormQuestion>

              <FormQuestion
                index={padIndex(start + 1)}
                label="教材的类型"
                required
              >
                <FormChoice
                  value={book.kind}
                  options={BOOK_KIND_OPTIONS}
                  columns={2}
                  onChange={(v) => setBookField(i, 'kind', v)}
                  aria-label={`${title}类型`}
                />
              </FormQuestion>

              <FormQuestion
                index={padIndex(start + 2)}
                label="教材的第一位主编"
                required
                hint="如果是外文书则不是翻译而是「原文主编」。"
              >
                <Input
                  value={book.editor}
                  onChange={(ev) => setBookField(i, 'editor', ev.target.value)}
                />
              </FormQuestion>

              <FormQuestion
                index={padIndex(start + 3)}
                label="教材的出版社"
                required
              >
                <Input
                  value={book.publisher}
                  onChange={(ev) =>
                    setBookField(i, 'publisher', ev.target.value)
                  }
                />
              </FormQuestion>

              <FormQuestion
                index={padIndex(start + 4)}
                label="教材的 ISBN 号"
                required
              >
                <Input
                  value={book.isbn}
                  onChange={(ev) => setBookField(i, 'isbn', ev.target.value)}
                  placeholder="978-…"
                  autoComplete="off"
                />
              </FormQuestion>

              <FormQuestion
                index={padIndex(start + 5)}
                label="您是否有教材的高清资源"
                required
              >
                <FormChoice
                  value={book.hasHd}
                  options={YES_NO_OPTIONS}
                  onChange={(v) => setBookField(i, 'hasHd', v)}
                  aria-label={`${title}是否有高清资源`}
                />
              </FormQuestion>

              {book.hasHd === 'yes' ? (
                <FormQuestion
                  index={padIndex(start + 6)}
                  label="上传高清资源文件"
                  required
                  hint="提交时才会开始上传；单文件不超过 50MB。"
                >
                  <FileInput
                    file={files[i] ?? null}
                    onChange={(next) =>
                      setFiles((prev) => ({ ...prev, [i]: next }))
                    }
                  />
                </FormQuestion>
              ) : null}
            </div>
          );
        })}

        {error ? <FormError>{error}</FormError> : null}

        <div className="pt-2">
          <Button type="submit" variant="primary" disabled={submitting}>
            提交
          </Button>
          <p className="mt-2 text-xs text-muted">
            未提交的文字内容会自动保存在本机；文件在点击提交后串行上传。
          </p>
        </div>
      </FormStack>
    </FormShell>
  );
};
