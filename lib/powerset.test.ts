import { powerset } from './powerset'

test('powerset', () => {
  expect(powerset([1, 2, 3])).toEqual([
    [1],
    [2],
    [1, 2],
    [3],
    [1, 3],
    [2, 3],
    [1, 2, 3],
  ])
})
