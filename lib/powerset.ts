export function powerset(array: number[]): number[][] {
  const sets = [[]]
  array.forEach((value) => {
    sets.push(...sets.map((set) => [...set, value]))
  })
  sets.shift() // Remove initial empty set
  return sets
}
