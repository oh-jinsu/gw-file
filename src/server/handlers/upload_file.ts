import { httpBadRequest, httpCreated, httpExceptionFromErr } from "gw-response";
import type { FileService } from "..";

export const uploadFileHandler = <TFile>({
  fileService,
}: {
  fileService: FileService<TFile>;
}) => {
  return async (request: Request, { userId }: { userId?: string }) => {
    const { name, type, size, metadata } = await request.json();

    const headers = {
      "Access-Control-Allow-Origin": "*",
    };

    if (typeof name !== "string") {
      return httpBadRequest(
        { code: "FILE_NAME_REQUIRED", message: "파일 이름이 필요합니다." },
        { headers },
      );
    }

    if (typeof type !== "string") {
      return httpBadRequest(
        { code: "FILE_TYPE_REQUIRED", message: "파일 타입이 필요합니다." },
        { headers },
      );
    }

    const result = await fileService.generateSignedUrl({
      userId,
      name,
      type,
      size,
      metadata,
    });

    if (result.isErr) {
      return httpExceptionFromErr(500, result);
    }

    return httpCreated(result.value, { headers });
  };
};
