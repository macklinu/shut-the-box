import { assign, createUpdater, ImmerUpdateEvent } from '@xstate/immer'
import { useMachine } from '@xstate/react'
import { allChoices } from 'lib/constants'
import { powerset } from 'lib/powerset'
import { rollDie } from 'lib/rollDie'
import { sum } from 'lib/sum'
import * as React from 'react'
import { createMachine } from 'xstate'

const initialContext = {
  remainingNumbers: allChoices,
  currentRoll: [],
  possibleMoves: [],
  selectedValues: [],
}

interface GameContext {
  remainingNumbers: number[]
  currentRoll: number[]
  possibleMoves: number[][]
  selectedValues: number[]
}

type GameTypeState =
  | { value: 'lobby'; context: GameContext }
  | { value: 'play'; context: GameContext }
  | { value: 'play.waiting'; context: GameContext }
  | { value: 'play.rolling'; context: GameContext }
  | { value: 'play.deciding'; context: GameContext }
  | { value: 'play.win'; context: GameContext }
  | { value: 'play.lose'; context: GameContext }

type SelectValueEvent = ImmerUpdateEvent<'SELECT_VALUE', number>
const selectValue = createUpdater<GameContext, SelectValueEvent>(
  'SELECT_VALUE',
  (context, { input }) => {
    context.selectedValues.push(input)
  }
)

type DeselectValueEvent = ImmerUpdateEvent<'DESELECT_VALUE', number>
const deselectValue = createUpdater<GameContext, DeselectValueEvent>(
  'DESELECT_VALUE',
  (context, { input }) => {
    context.selectedValues = context.selectedValues.filter(
      (value) => value !== input
    )
  }
)

type GameEvent =
  | { type: 'START' }
  | { type: 'WIN' }
  | { type: 'LOSE' }
  | { type: 'ROLL' }
  | SelectValueEvent
  | DeselectValueEvent
  | { type: 'SUBMIT_MOVE' }
  | { type: 'LOBBY' }
  | { type: 'RETRY' }

const gameStateMachine = createMachine<GameContext, GameEvent, GameTypeState>({
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
            [selectValue.type]: {
              actions: selectValue.action,
              cond: 'canSelectValue',
            },
            [deselectValue.type]: {
              actions: deselectValue.action,
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

export function useGameStateMachine() {
  const [current, send] = useMachine<GameContext, GameEvent, GameTypeState>(
    gameStateMachine,
    {
      devTools: process.env.NODE_ENV === 'development',
      guards: {
        didPlayerWin: ({ remainingNumbers }) => remainingNumbers.length === 0,
        didPlayerLose: ({ possibleMoves }) => possibleMoves.length === 0,
        canSelectValue: ({ possibleMoves }, { input }: SelectValueEvent) =>
          possibleMoves.some((moves) => moves.includes(input)),
        canSubmit: ({ currentRoll, selectedValues }) =>
          selectedValues.length > 0 && sum(currentRoll) === sum(selectedValues),
      },
      actions: {
        rollDice: assign((context) => {
          context.currentRoll = [rollDie(), rollDie()]
        }),
        resetGameState: assign((context) => {
          Object.assign(context, initialContext)
        }),
        calculateMoves: assign((context) => {
          const totalValue = sum(context.currentRoll)
          context.possibleMoves = powerset(context.remainingNumbers).filter(
            (set) => sum(set) === totalValue
          )
        }),
        clearSelectedValues: assign((context) => {
          context.selectedValues = []
          context.currentRoll = []
        }),
        updateRemainingNumbers: assign((context) => {
          context.remainingNumbers = context.remainingNumbers.filter(
            (number) => !context.selectedValues.includes(number)
          )
        }),
      },
    }
  )

  const actions = React.useMemo(() => {
    return {
      start: () => send('START'),
      roll: () => send('ROLL'),
      submitMove: () => send('SUBMIT_MOVE'),
      retry: () => send('RETRY'),
      selectValue: (value: number) => send(selectValue.update(value)),
      deselectValue: (value: number) => send(deselectValue.update(value)),
    }
  }, [])
  return [current, actions] as const
}
