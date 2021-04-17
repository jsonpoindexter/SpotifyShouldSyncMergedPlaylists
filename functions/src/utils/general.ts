export const isUnique = (
  value: unknown,
  index: number,
  self: unknown[],
): boolean => self.indexOf(value) === index
