export const materialTitleLimit = 300;

export function isValidMaterialTitle(title: string): boolean {
  const normalized = title.trim();
  return (
    normalized.length > 0 &&
    normalized.length <= materialTitleLimit &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(normalized)
  );
}
