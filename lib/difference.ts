export function difference<TValue>(
  setA: Set<TValue>,
  setB: Set<TValue>
): Set<TValue> {
  let diff = new Set(setA)
  for (let elem of setB) {
    diff.delete(elem)
  }
  return diff
}
