export interface FileRecord {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  sequence: number;
  content: Buffer;
}

export interface FileMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}
