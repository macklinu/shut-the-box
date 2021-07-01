import { rollDie } from './rollDie'

test('die roll is always between 1 and 6', () => {
  const times = 20
  for (let i = 0; i++; i < times) {
    const number = rollDie()
    expect(number).toBeGreaterThanOrEqual(1)
    expect(number).toBeLessThanOrEqual(6)
  }
})
