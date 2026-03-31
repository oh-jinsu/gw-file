import { resultFrom } from "gw-result";
import type { FileRepository } from "../file_repository";
import {
  httpForbidden,
  httpInternalServerError,
  httpNoContent,
  httpNotFound,
} from "gw-response";

export const deleteFileHandler =
  <TFile>({ fileRepository }: { fileRepository: FileRepository<TFile> }) =>
  ({ userId, fileId }: { userId?: string; fileId: string }) =>
  async () => {
    const file = await fileRepository.findFileById(fileId);

    const headers = {
      "Access-Control-Allow-Origin": "*",
    };

    if (!file) {
      return httpNotFound(
        {
          code: "FILE_NOT_FOUND",
          message: "파일을 찾을 수 없습니다.",
        },
        { headers },
      );
    }

    if (fileRepository.isForbidden(file, userId)) {
      return httpForbidden(
        {
          code: "FILE_DELETE_FORBIDDEN",
          message: "파일을 삭제할 권한이 없습니다.",
        },
        { headers },
      );
    }

    const deleteResult = await resultFrom(() =>
      fileRepository.deleteFile(fileId),
    );

    if (deleteResult.isErr) {
      return httpInternalServerError(
        {
          code: "FILE_DELETE_FAILED",
          message: "파일 삭제에 실패했습니다.",
        },
        { headers },
      );
    }

    return httpNoContent({ headers });
  };
