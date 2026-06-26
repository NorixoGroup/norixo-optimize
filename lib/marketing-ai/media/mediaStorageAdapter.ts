import type { MediaBinary } from "./mediaBinary";

export type MediaStorageUploadResult = {
  provider: string;
  path: string;
  previewUrl: string | null;
  downloadUrl: string | null;
};

export interface MediaStorageAdapter {
  id: string;
  label: string;

  upload(binary: MediaBinary): Promise<MediaStorageUploadResult>;

  delete(path: string): Promise<void>;
}

export const fakeMediaStorageAdapter: MediaStorageAdapter = {
  id: "fake-storage",
  label: "Fake Media Storage",

  async upload(binary) {
    return {
      provider: "fake-storage",
      path: `fake/${binary.filename}`,
      previewUrl: null,
      downloadUrl: null,
    };
  },

  async delete() {
    return;
  },
};
