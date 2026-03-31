import {
  exception,
  exceptionFromResponse,
  fetchWithResult,
  ok,
} from "gw-result";
import { generateMetadata } from "./metadata";

export type FileUploaderOptions = {
  metadata?: Record<string, unknown>;
  convertToWebp?: boolean;
};

export class FileUploader<TFile> {
  endpoint: string;

  constructor(endpoint: string = "/api/files") {
    this.endpoint = endpoint;

    this.uploadFile = this.uploadFile.bind(this);
    this.uploadBlob = this.uploadBlob.bind(this);
    this.deleteFile = this.deleteFile.bind(this);
  }

  uploadFile(file: File, options: FileUploaderOptions = {}) {
    return this.uploadBlob(file, file.name, options);
  }

  async uploadBlob(
    blob: Blob,
    name = "blob",
    options: FileUploaderOptions = {},
  ) {
    if (
      options.convertToWebp &&
      blob.type.startsWith("image/") &&
      blob.type !== "image/webp"
    ) {
      const img = document.createElement("img");

      img.src = URL.createObjectURL(blob);

      await img.decode();

      const canvas = document.createElement("canvas");

      canvas.width = img.width;

      canvas.height = img.height;

      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }

      const webpBlob: Blob | null = await new Promise((resolve) => {
        canvas.toBlob((b) => {
          resolve(b);
        }, "image/webp");
      });

      if (webpBlob) {
        blob = webpBlob;
        name = name.replace(/\.[^/.]+$/, "") + ".webp";
      }
    }

    const { type, size } = blob;

    const metadataForMedia = await generateMetadata(blob);

    const metadata = {
      ...metadataForMedia,
      ...options.metadata,
    };

    const fileResult = await fetchWithResult(this.endpoint, {
      method: "POST",
      body: JSON.stringify({
        name: name.replace(/ /g, "_"),
        type,
        size,
        metadata,
      }),
    });

    if (fileResult.isErr) {
      return fileResult;
    }

    const fileRes = fileResult.value;

    if (!fileRes.ok) {
      return exceptionFromResponse(fileRes);
    }

    const result = await fileRes.json();

    const { signedUrl, file } = result;

    const uploadResult = await fetchWithResult(signedUrl, {
      method: "PUT",
      body: blob,
    });

    if (uploadResult.isErr) {
      return uploadResult;
    }

    const uploadRes = uploadResult.value;

    if (!uploadRes.ok) {
      return exception("UPLOAD_FAILED", "파일 업로드에 실패했습니다.");
    }

    return ok(file as TFile);
  }

  async deleteFile(fileId: string) {
    const fetchResult = await fetchWithResult(`${this.endpoint}/${fileId}`, {
      method: "DELETE",
    });

    if (fetchResult.isErr) {
      return fetchResult;
    }

    const res = fetchResult.value;

    if (!res.ok) {
      return exceptionFromResponse(res);
    }

    return ok();
  }
}
