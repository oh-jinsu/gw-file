# gw-file

File handling toolkit for TypeScript applications.

`gw-file` provides a server-side file service (signed upload URLs + repository abstraction) and client-side helpers (upload client, media metadata, responsive image utilities).

## Features

- Server utilities for file records and object storage uploads
- Pre-signed upload URL flow via AWS S3 SDK
- Repository interface so you can plug in any database/ORM
- Client uploader with optional image-to-WebP conversion
- Automatic image/video metadata extraction
- React responsive image component factory with CDN helpers

## Install

```bash
npm install gw-file
```

Peer dependencies for client React utilities:

```bash
npm install react react-dom
```

## Package Exports

```ts
import { createCDN } from "gw-file";
import { FileService, ObjectStorage } from "gw-file/server";
import { FileUploader, ResponsiveImage } from "gw-file/client";
```

## How It Works

1. Client requests upload metadata from your API.
2. Server creates file record and returns a signed upload URL.
3. Client uploads binary directly to object storage.
4. Client keeps returned file record for later use.

This keeps your API server out of large file transfer paths.

## Server Usage

### 1) Create Object Storage

```ts
import { ObjectStorage } from "gw-file/server";

const objectStorage = new ObjectStorage({
  bucketName: process.env.AWS_BUCKET_NAME!,
  region: "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
```

### 2) Implement FileRepository

`FileService` is database-agnostic. Implement `FileRepository<TFile>` for your persistence layer.

```ts
import type { FileRepository } from "gw-file/server";

type AppFile = {
  id: string;
  userId?: string;
  name: string;
  type?: string;
  size?: number;
  key: string;
  metadata?: Record<string, any>;
};

class InMemoryFileRepository implements FileRepository<AppFile> {
  private files = new Map<string, AppFile>();

  async findFileById(fileId: string) {
    return this.files.get(fileId);
  }

  isForbidden(file: AppFile, userId?: string) {
    return Boolean(file.userId && file.userId !== userId);
  }

  async createFile(fileData: {
    id: string;
    userId?: string;
    name: string;
    type?: string;
    size?: number;
    metadata?: Record<string, any>;
    key: string;
  }) {
    const file: AppFile = { ...fileData };
    this.files.set(file.id, file);
    return file;
  }

  async deleteFile(fileId: string) {
    this.files.delete(fileId);
  }
}
```

### 3) Create FileService

```ts
import { FileService } from "gw-file/server";

const fileRepository = new InMemoryFileRepository();

const fileService = new FileService({
  prefix: "user", // path prefix used in object key: user/<uuid>/<fileName>
  fileRepository,
  objectStorage,
});
```

### 4) Wire HTTP Handlers

Build your own route handlers using `FileService` and your repository access checks.

Example with Fetch-compatible handlers:

```ts
import { FileService } from "gw-file/server";

export async function handleUpload(request: Request, userId?: string) {
  const { name, type, size, metadata } = await request.json();

  const result = await fileService.generateSignedUrl({
    userId,
    name,
    type,
    size,
    metadata,
  });

  if (result.isErr) {
    return new Response(JSON.stringify({ code: "UPLOAD_PREPARE_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result.value), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}

export async function handleDelete(fileId: string, userId?: string) {
  const file = await fileRepository.findFileById(fileId);

  if (!file) {
    return new Response(JSON.stringify({ code: "FILE_NOT_FOUND" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  if (fileRepository.isForbidden(file, userId)) {
    return new Response(JSON.stringify({ code: "FILE_DELETE_FORBIDDEN" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  await fileRepository.deleteFile(fileId);

  return new Response(null, { status: 204 });
}
```

## Client Usage

### FileUploader

```ts
import { FileUploader } from "gw-file/client";

type AppFile = {
  id: string;
  key: string;
  name: string;
  type?: string;
  size?: number;
  metadata?: Record<string, unknown>;
};

const uploader = new FileUploader<AppFile>("/api/files");

const result = await uploader.uploadFile(fileInput.files![0], {
  convertToWebp: true,
  metadata: { source: "profile-form" },
});

if (result.isErr) {
  console.error(result.error);
} else {
  console.log("uploaded", result.value);
}
```

`FileUploader` methods:

- `uploadFile(file, options?)`
- `uploadBlob(blob, name?, options?)`
- `deleteFile(fileId)`

### generateMetadata

`generateMetadata(blob)` automatically returns:

- For images: `{ width, height }`
- For videos: `{ width, height, poster }`
- For other files: `{}`

You can pass `uploadBlob` to store generated video posters externally instead of embedding a data URL.

```ts
import { generateMetadata } from "gw-file/client";

const metadata = await generateMetadata(file, {
  uploadBlob: async (posterBlob) => {
    const result = await uploader.uploadBlob(posterBlob, "poster.jpg");
    if (result.isErr) throw result.error;
    return { src: `/cdn/${result.value.key}` };
  },
});
```

## CDN and Responsive Images

### createCDN

```ts
import { createCDN } from "gw-file";

const cdn = createCDN("https://cdn.example.com");
const url = cdn("user/abc/profile.webp", { width: 640 });
// https://cdn.example.com/user/abc/profile.webp?w=640
```

### ResponsiveImage (React)

```tsx
import { createResponsiveImage } from "gw-file/client";

const AppImage = createResponsiveImage({
  cdnOrigin: "https://cdn.example.com",
  defaultProps: { loading: "lazy", decoding: "async" },
});

export function Profile({ file }: { file: { key: string } }) {
  return (
    <AppImage
      file={file}
      alt="Profile"
      width={320}
      ratio={1}
      style={{ borderRadius: 12 }}
    />
  );
}
```

The generated component builds `srcSet` automatically (except for `.gif`) and supports both width-descriptor and pixel-density variants.

## API Reference

### Server

- `ObjectStorage`
  - `generateSignedUrl(key, { contentType?, expiresIn? })`
  - `head(key)`
  - `find(key)`
  - `put(key, buffer, { contentType? })`
  - `delete(key)`
- `FileService<TFile>`
  - `generateSignedUrl(params)`
  - `put(buffer, params)`
  - `putBlob(blob, params)`
- `FileRepository<TFile>` interface
- `uploadFileHandler`
- `deleteFileHandler`

### Client

- `FileUploader<TFile>`
- `generateMetadata`
- `createResponsiveImage`
- `ResponsiveImage`
- `generateSrcSet`

### Root

- `createCDN`

## Build

```bash
npm run build
```

## License

MIT
