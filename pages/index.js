import * as React from 'react'
import Head from 'next/head'
import { createMachine, assign } from 'xstate'
import { useMachine } from '@xstate/react'
import { inspect } from '@xstate/inspect'
import { powerset } from 'lib/powerset'
import cx from '@macklinu/cx'

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

function Tile({ selectable, selected, closed, children, className, ...props }) {
  return (
    <div
      {...props}
      className={cx(
        'border rounded py-6 px-4 cursor-pointer font-black md:text-xl',
        selectable && 'border-green-500',
        selected && 'border-green-600 bg-green-100 transform scale-110',
        closed && 'bg-gray-500',
        className
      )}
    >
      {children}
    </div>
  )
}

const allChoices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function rollDie() {
  return Math.floor(Math.random() * 6) + 1
}

function sum(array) {
  return array.reduce((a, b) => a + b, 0)
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
    <div className='h-screen'>
      <Head>
        <title>Shut the Box</title>
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <main className='p-4'>
        {current.matches('lobby') ? (
          <button onClick={() => send('START')}>Start</button>
        ) : null}
        {current.matches('play') ? (
          <section className='flex flex-col justify-between items-center'>
            <button
              disabled={!current.matches({ play: 'waiting' })}
              onClick={() => send('ROLL')}
            >
              Roll
            </button>
            <div className='self-center'>
              {current.matches('play.rolling') ? (
                <>Rolling...</>
              ) : (
                currentRoll?.join(', ')
              )}
            </div>
            <div className='absolute bottom-0 py-4 flex flex-col items-center'>
              {current.matches('play.deciding') ? (
                <ThreeDimensionalButton
                  disabled={sum(selectedValues) !== sum(currentRoll)}
                  onClick={() => send('SUBMIT_MOVE')}
                >
                  OK
                </ThreeDimensionalButton>
              ) : null}
              <div className='flex flex-row space-x-2 mt-4'>
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
            </div>
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

function ThreeDimensionalButton({ className, ...props }) {
  return (
    <button
      className={cx(
        'text-white font-bold py-2 px-6 border-b-4 rounded w-min-content',
        props.disabled
          ? 'bg-gray-500 border-gray-700 cursor-not-allowed'
          : 'bg-blue-500 border-blue-700 hover:bg-blue-400 hover:border-blue-500 cursor-pointer'
      )}
      {...props}
    />
  )
}
