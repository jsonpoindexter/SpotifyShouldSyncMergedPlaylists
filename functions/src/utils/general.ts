export const isUnique = (
  value: unknown,
  index: number,
  self: unknown[],
): boolean => self.indexOf(value) === index

export const isObjectEmpty = (object: Record<string, unknown>): boolean =>
  object && Object.keys(object).length === 0 && object.constructor === Object
