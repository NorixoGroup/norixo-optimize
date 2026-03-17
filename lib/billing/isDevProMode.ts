export function isDevProMode(): boolean {
  return process.env.NEXT_PUBLIC_DEV_PRO_MODE === "true";
}
