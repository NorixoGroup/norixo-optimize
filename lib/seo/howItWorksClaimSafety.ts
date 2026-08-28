export function getIllustrativeAuditPreviewCopy() {
  return {
    scoreValue: "Illustrative",
    scoreScale: "example",
    qualityValue: "Illustrative",
    qualityScale: "example",
    impactLabel: "Potential areas to review",
    impactDetail:
      "Actual findings depend on the listing, market context, available data, and the audit performed.",
  } as const;
}
