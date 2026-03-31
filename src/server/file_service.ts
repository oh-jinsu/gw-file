import { v4 } from "uuid";
import type { ObjectStorage } from "./object_storage";
import type { FileRepository } from "./file_repository";
import { ok, resultFrom } from "gw-result";

export type UploadFileParams = {
  name: string;
  userId?: string;
  type?: string;
  size?: number;
  metadata?: Record<string, any>;
};

export class FileService<TFile> {
  prefix: string;
  fileRepository: FileRepository<TFile>;
  objectStorage: ObjectStorage;

  constructor({
    prefix = "user",
    fileRepository,
    objectStorage,
  }: {
    prefix?: string;
    fileRepository: FileRepository<TFile>;
    objectStorage: ObjectStorage;
  }) {
    this.prefix = prefix;
    this.fileRepository = fileRepository;
    this.objectStorage = objectStorage;
  }

  async generateSignedUrl(params: UploadFileParams) {
    const fileResult = await this.createFileReference(params);

    if (fileResult.isErr) {
      return fileResult;
    }

    const { key, file } = fileResult.value;

    const signedUrlResult = await resultFrom(() =>
      this.objectStorage.generateSignedUrl(key, {
        contentType: params.type,
      }),
    );

    if (signedUrlResult.isErr) {
      return signedUrlResult;
    }

    const signedUrl = signedUrlResult.value;

    return ok({ file, signedUrl });
  }

  async put(buffer: Buffer, params: UploadFileParams) {
    const fileResult = await this.createFileReference(params);

    if (fileResult.isErr) {
      return fileResult;
    }

    const { key, file } = fileResult.value;

    const putResult = await resultFrom(() =>
      this.objectStorage.put(key, buffer, { contentType: params.type }),
    );

    if (putResult.isErr) {
      return putResult;
    }

    return ok(file);
  }

  async putBlob(blob: Blob, params: UploadFileParams) {
    const arrayBuffer = await blob.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    return this.put(buffer, params);
  }

  private async createFileReference(params: UploadFileParams) {
    const id = v4();

    const key = `${this.prefix}/${id}/${params.name}`;

    const fileResult = await resultFrom(() =>
      this.fileRepository.createFile({
        id,
        key,
        ...params,
      }),
    );

    if (fileResult.isErr) {
      return fileResult;
    }

    return ok({ key, file: fileResult.value });
  }
}
