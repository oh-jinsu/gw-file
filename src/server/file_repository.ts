export interface FileRepository<TFile = unknown> {
  findFileById(fileId: string): Promise<TFile | undefined>;

  isForbidden(file: TFile, userId?: string): boolean;

  createFile(fileData: {
    id: string;
    userId?: string;
    name: string;
    type?: string;
    size?: number;
    metadata?: Record<string, any>;
    key: string;
  }): Promise<TFile>;

  deleteFile(fileId: string): Promise<void>;
}
