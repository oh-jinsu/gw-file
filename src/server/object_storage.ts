import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { exception, ok, resultFrom } from "gw-result";

export class ObjectStorage {
  private client: S3Client;

  private bucketName: string;

  constructor({
    bucketName,
    ...config
  }: { bucketName: string } & S3ClientConfig) {
    this.client = new S3Client({
      region: "ap-northeast-2",
      ...config,
    });

    this.bucketName = bucketName;
  }

  async generateSignedUrl(
    key: string,
    {
      contentType,
      expiresIn = 3600,
    }: { contentType?: string; expiresIn?: number } = {},
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,

      ContentType: contentType,
    });

    const signedUrlResult = await resultFrom(() =>
      getSignedUrl(this.client, command, {
        expiresIn,
      }),
    );

    return signedUrlResult;
  }

  async head(key: string) {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const headResult = await resultFrom(() => this.client.send(command));

    if (headResult.isErr) {
      if (headResult.error.name === "NotFound") {
        return ok(false);
      }

      return headResult;
    }

    return ok(true);
  }

  async find(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const getObjectResult = await resultFrom(() => this.client.send(command));

    if (getObjectResult.isErr) {
      return getObjectResult;
    }

    const { Body } = getObjectResult.value;

    if (!Body) {
      return exception("BODY_NOT_FOUND", "데이터를 찾을 수 없습니다.");
    }

    return ok(Body.transformToByteArray());
  }

  async put(
    key: string,
    buffer: Buffer,
    { contentType }: { contentType?: string } = {},
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Body: buffer,
    });

    const putObjectResult = await resultFrom(() => this.client.send(command));

    if (putObjectResult.isErr) {
      return putObjectResult;
    }

    return ok(putObjectResult.value);
  }
}
