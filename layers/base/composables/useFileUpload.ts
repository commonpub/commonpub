/**
 * useFileUpload — single source of truth for the `/api/files/upload` POST.
 *
 * Eight call sites used to copy-paste the same `FormData` + `$fetch` dance
 * (build FormData, append `file`, optionally append `purpose`, POST as
 * multipart). They diverged only in the response shape they read back
 * (`{ url }`, plus optional `originalName`/`size`/`sizeBytes`/`mimeType`/
 * `width`/`height`) and in how they handle errors. This composable owns the
 * request; callers keep their own success/error handling and pick the response
 * shape via the `T` type parameter.
 *
 * Behaviour is identical to the previous inline code: same endpoint, same
 * field names (`file`, optional `purpose`), same multipart body, errors
 * propagate to the caller (no swallowing here).
 */

/** Every upload response includes at least the stored URL. */
export interface FileUploadResult {
  url: string;
}

export interface UseFileUpload {
  /**
   * POST a file to `/api/files/upload` as multipart FormData.
   *
   * @param file    the File/Blob to upload (appended as the `file` field).
   * @param purpose optional upload purpose (e.g. 'avatar', 'banner', 'cover',
   *                'content'); appended as the `purpose` field when provided.
   *                Omit it to match the legacy hub-post upload, which sent none.
   * @returns the parsed JSON response, typed by the caller via `T`.
   */
  uploadFile: <T extends FileUploadResult = FileUploadResult>(
    file: Blob,
    purpose?: string,
  ) => Promise<T>;
}

export function useFileUpload(): UseFileUpload {
  async function uploadFile<T extends FileUploadResult = FileUploadResult>(
    file: Blob,
    purpose?: string,
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    if (purpose !== undefined) {
      formData.append('purpose', purpose);
    }
    return await $fetch<T>('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
  }

  return { uploadFile };
}
