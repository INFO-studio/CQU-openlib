import { apiUrl } from '~/lib/apiBase';

export type StagingFileRef = {
  key: string;
  name: string;
  size: number;
};

export type UploadProgress = {
  /** Overall 0–1 across all files + final form POST. */
  ratio: number;
  /** Human label under the ring. */
  label: string;
  fileIndex: number;
  fileTotal: number;
};

type TokenResponse = {
  success?: boolean;
  token?: string;
  key?: string;
  uploadHost?: string;
  message?: string;
};

const MAX_BYTES = 50 * 1024 * 1024;

const readErrorMessage = async (res: Response, fallback: string) => {
  try {
    const data = (await res.json()) as { message?: string };
    if (data.message?.trim()) return data.message.trim();
  } catch {
    /* ignore */
  }
  return fallback;
};

/** Mint one Qiniu upload token from our API. */
export const mintStagingToken = async (
  filename: string,
): Promise<{ token: string; key: string; uploadHost: string }> => {
  const res = await fetch(apiUrl('/staging/token'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `签发上传凭证失败（${res.status}）`));
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.token || !data.key || !data.uploadHost) {
    throw new Error(data.message?.trim() || '签发上传凭证失败');
  }
  return { token: data.token, key: data.key, uploadHost: data.uploadHost };
};

/** Upload one file to Qiniu with XHR progress (0–1 for this file). */
export const uploadToQiniu = (
  file: File,
  minted: { token: string; key: string; uploadHost: string },
  onFileProgress?: (ratio: number) => void,
): Promise<StagingFileRef> =>
  new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) {
      reject(new Error(`「${file.name}」超过 50MB 上限`));
      return;
    }

    const body = new FormData();
    body.append('token', minted.token);
    body.append('key', minted.key);
    body.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', minted.uploadHost);
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable || ev.total <= 0) return;
      onFileProgress?.(Math.min(1, ev.loaded / ev.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onFileProgress?.(1);
        resolve({ key: minted.key, name: file.name, size: file.size });
        return;
      }
      reject(new Error(`上传「${file.name}」失败（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error(`上传「${file.name}」网络错误`));
    xhr.onabort = () => reject(new Error(`上传「${file.name}」已取消`));
    xhr.send(body);
  });

/**
 * Serial upload: mint token → Qiniu for each file, one after another.
 * `onProgress.ratio` covers only the file phase (0–1).
 */
export const uploadFilesSerially = async (
  files: File[],
  onProgress?: (progress: Omit<UploadProgress, 'label'> & { label?: string }) => void,
): Promise<StagingFileRef[]> => {
  const total = files.length;
  if (total === 0) return [];

  const results: StagingFileRef[] = [];
  for (let i = 0; i < total; i += 1) {
    const file = files[i];
    onProgress?.({
      ratio: i / total,
      fileIndex: i + 1,
      fileTotal: total,
      label: `上传文件 ${i + 1}/${total}`,
    });

    const minted = await mintStagingToken(file.name);
    const ref = await uploadToQiniu(file, minted, (fileRatio) => {
      onProgress?.({
        ratio: (i + fileRatio) / total,
        fileIndex: i + 1,
        fileTotal: total,
        label: `上传文件 ${i + 1}/${total}`,
      });
    });
    results.push(ref);
  }

  onProgress?.({
    ratio: 1,
    fileIndex: total,
    fileTotal: total,
    label: '文件已上传',
  });
  return results;
};

export type SubmitFormResult = { id: string };

/** POST /form after optional serial file uploads. */
export const submitForm = async <TPayload>(
  type: string,
  payload: TPayload,
): Promise<SubmitFormResult> => {
  const res = await fetch(apiUrl('/form'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `提交失败（${res.status}）`));
  }
  const data = (await res.json()) as { success?: boolean; id?: string; message?: string };
  if (!data.success || !data.id) {
    throw new Error(data.message?.trim() || '提交失败');
  }
  return { id: data.id };
};

/**
 * Upload files (if any), then submit form.
 * Progress: files take 0–0.9, final POST takes 0.9–1.
 */
export const submitFormWithFiles = async <TPayload>(opts: {
  type: string;
  files: File[];
  buildPayload: (uploaded: StagingFileRef[]) => TPayload;
  onProgress?: (progress: UploadProgress) => void;
}): Promise<SubmitFormResult> => {
  const { type, files, buildPayload, onProgress } = opts;
  const fileWeight = files.length > 0 ? 0.9 : 0;

  const uploaded =
    files.length === 0
      ? []
      : await uploadFilesSerially(files, (p) => {
          onProgress?.({
            ratio: p.ratio * fileWeight,
            label: p.label ?? '上传中',
            fileIndex: p.fileIndex,
            fileTotal: p.fileTotal,
          });
        });

  onProgress?.({
    ratio: fileWeight,
    label: '提交表单',
    fileIndex: files.length,
    fileTotal: Math.max(files.length, 1),
  });

  const result = await submitForm(type, buildPayload(uploaded));

  onProgress?.({
    ratio: 1,
    label: '完成',
    fileIndex: files.length,
    fileTotal: Math.max(files.length, 1),
  });

  return result;
};
