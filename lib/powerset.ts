export function powerset(array: number[]): number[][] {
  const sets = array.reduce(
    (subsets, value) => subsets.concat(subsets.map((set) => [...set, value])),
    [[]]
  )
  sets.shift() // Remove empty set
  return sets
}
