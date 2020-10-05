import * as React from 'react'
import Head from 'next/head'
import { createMachine, assign } from 'xstate'
import { useMachine } from '@xstate/react'
import { inspect } from '@xstate/inspect'
import { powerset } from 'lib/powerset'
import tw, { styled } from 'twin.macro'

const initialContext = {
  remainingNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  currentRoll: undefined,
  possibleMoves: undefined,
  selectedValues: [],
}

const gameStateMachine = createMachine({
  id: 'game',
  initial: 'play', // TODO move back to lobby once there's a lobby screen
  context: initialContext,
  states: {
    lobby: {
      on: {
        START: 'play',
      },
    },
    play: {
      id: 'play',
      initial: 'waiting',
      entry: 'resetGameState',
      on: {
        WIN: '#play.win',
        LOSE: '#play.lose',
      },
      states: {
        waiting: {
          on: {
            ROLL: 'rolling',
          },
          entry: ['clearSelectedValues'],
          always: [{ target: 'win', cond: 'didPlayerWin' }],
        },
        rolling: {
          entry: ['rollDice', 'calculateMoves'],
          after: {
            1000: 'deciding',
          },
        },
        deciding: {
          always: [{ target: 'lose', cond: 'didPlayerLose' }],
          on: {
            SELECT_VALUE: {
              actions: 'selectValue',
              cond: 'canSelectValue',
            },
            DESELECT_VALUE: {
              actions: 'deselectValue',
            },
            SUBMIT_MOVE: {
              target: 'waiting',
              cond: 'canSubmit',
              actions: 'updateRemainingNumbers',
            },
          },
        },
        win: {
          on: {
            LOBBY: '#game.lobby',
            RETRY: {
              target: '#game.play',
              actions: 'resetGameState',
            },
          },
        },
        lose: {
          on: {
            LOBBY: '#game.lobby',
            RETRY: {
              target: '#game.play',
              actions: 'resetGameState',
            },
          },
        },
      },
    },
  },
})

try {
  inspect({
    url: 'https://statecharts.io/inspect',
    iframe: false,
  })
} catch {}

const Tile = styled.div(({ selectable, selected, closed }) => [
  tw`border rounded py-4 px-3 cursor-pointer font-black`,
  selectable && tw`border-green-500`,
  selected && tw`border-green-600 bg-green-100 transform scale-110`,
  closed && tw`bg-gray-500`,
])

const allChoices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function rollDie() {
  return Math.floor(Math.random() * 6) + 1
}

function sum(array) {
  return array.reduce((a, b) => a + b)
}

function difference(setA, setB) {
  let _difference = new Set(setA)
  for (let elem of setB) {
    _difference.delete(elem)
  }
  return _difference
}

export default function Home() {
  const [current, send] = useMachine(gameStateMachine, {
    devTools: process.env.NODE_ENV === 'development',
    guards: {
      didPlayerWin({ remainingNumbers }) {
        return remainingNumbers.length === 0
      },
      didPlayerLose({ possibleMoves }) {
        return possibleMoves.length === 0
      },
      canSelectValue({ possibleMoves }, { value }) {
        return possibleMoves.some((move) => move.includes(value))
      },
      canSubmit({ currentRoll, selectedValues }) {
        return (
          selectedValues.length > 0 && sum(currentRoll) === sum(selectedValues)
        )
      },
    },
    actions: {
      rollDice: assign({
        currentRoll: () => [rollDie(), rollDie()],
      }),
      resetGameState: assign(initialContext),
      calculateMoves: assign({
        possibleMoves: ({ currentRoll, remainingNumbers }) => {
          const totalValue = sum(currentRoll)
          return powerset(remainingNumbers).filter(
            (set) => sum(set) === totalValue
          )
        },
      }),
      selectValue: assign({
        selectedValues: ({ selectedValues }, { value }) => [
          ...selectedValues,
          value,
        ],
      }),
      deselectValue: assign({
        selectedValues: ({ selectedValues }, { value }) =>
          selectedValues.filter((v) => v !== value),
      }),
      clearSelectedValues: assign({
        selectedValues: () => [],
        currentRoll: () => [],
      }),
      updateRemainingNumbers: assign({
        remainingNumbers: ({ remainingNumbers, selectedValues }) =>
          remainingNumbers.filter((number) => !selectedValues.includes(number)),
      }),
    },
  })
  const {
    possibleMoves,
    currentRoll,
    remainingNumbers,
    selectedValues,
  } = current.context
  const possibleChoices = React.useMemo(() => {
    if (current.matches('play.deciding')) {
      if (selectedValues.length === 0) {
        return new Set(possibleMoves.flat())
      }
      const possibleChoices = new Set()
      possibleMoves
        .filter((move) =>
          selectedValues.every((number) => move.includes(number))
        )
        .forEach((move) => {
          move.forEach((number) => possibleChoices.add(number))
        })
      return difference(possibleChoices, new Set(selectedValues))
    }
    return new Set()
  }, [current, possibleMoves, selectedValues])

  return (
    <div>
      <Head>
        <title>Shut the Box</title>
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <main tw='p-4'>
        {current.matches('lobby') ? (
          <button onClick={() => send('START')}>Start</button>
        ) : null}
        {current.matches('play') ? (
          <section>
            <button
              disabled={!current.matches({ play: 'waiting' })}
              onClick={() => send('ROLL')}
            >
              Roll
            </button>
            <div tw='h-8'>
              {current.matches('play.rolling') ? (
                <>Rolling...</>
              ) : (
                currentRoll?.join(', ')
              )}
            </div>
            <div tw='flex flex-row space-x-2'>
              {allChoices.map((choice) => {
                const selectable = possibleChoices.has(choice)
                const selected = selectedValues.includes(choice)
                const closed = !remainingNumbers.includes(choice)
                return (
                  <Tile
                    key={choice}
                    selectable={selectable}
                    selected={selected}
                    closed={closed}
                    onClick={() => {
                      if (selected) {
                        send('DESELECT_VALUE', { value: choice })
                      } else {
                        send('SELECT_VALUE', { value: choice })
                      }
                    }}
                  >
                    {choice}
                  </Tile>
                )
              })}
            </div>
            {current.matches('play.deciding') ? (
              <button onClick={() => send('SUBMIT_MOVE')}>Submit</button>
            ) : null}
            {current.matches('play.lose') ? (
              <section>
                <div>You lost. 😢</div>
                <button onClick={() => send('RETRY')}>Play Again</button>
              </section>
            ) : null}
            {current.matches('play.win') ? (
              <section>
                <div>You won! 😆</div>
                <button onClick={() => send('RETRY')}>Play Again</button>
              </section>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  )
}
