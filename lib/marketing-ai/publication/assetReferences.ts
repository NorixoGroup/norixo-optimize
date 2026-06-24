export type AssetStatus =
  | "missing"
  | "generated"
  | "uploaded";

export type AssetReference = {
  id: string;
  kind: "image" | "video" | "reel" | "carousel";
  status: AssetStatus;
  prompt?: string;
  localPath?: string;
  publicUrl?: string;
  thumbnailUrl?: string;
};

export type PublisherAssetReferences = {
  image?: AssetReference;
  video?: AssetReference;
  reel?: AssetReference;
};
