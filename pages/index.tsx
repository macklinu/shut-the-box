import cx from '@macklinu/cx'
import { inspect } from '@xstate/inspect'
import { allChoices } from 'lib/constants'
import { difference } from 'lib/difference'
import { useGameStateMachine } from 'lib/gameStateMachine'
import { sum } from 'lib/sum'
import Head from 'next/head'
import * as React from 'react'

try {
  if (process.env.NODE_ENV === 'development') {
    inspect({
      url: 'https://statecharts.io/inspect',
      iframe: false,
    })
  }
} catch {}

interface TileProps extends React.HTMLAttributes<HTMLDivElement> {
  selectable: boolean
  selected: boolean
  closed: boolean
}

function Tile({
  selectable,
  selected,
  closed,
  children,
  className,
  ...props
}: TileProps) {
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

export default function Home() {
  const [
    current,
    { roll, start, retry, submitMove, selectValue, deselectValue },
  ] = useGameStateMachine()
  const { possibleMoves, currentRoll, remainingNumbers, selectedValues } =
    current.context
  const possibleChoices = React.useMemo(() => {
    if (current.matches('play.deciding')) {
      if (selectedValues.length === 0) {
        return new Set(possibleMoves.flat())
      }
      const possibleChoices = new Set<number>()
      possibleMoves
        .filter((move) =>
          selectedValues.every((number) => move.includes(number))
        )
        .forEach((move) => {
          move.forEach((number) => {
            possibleChoices.add(number)
          })
        })
      return difference(possibleChoices, new Set(selectedValues))
    }
    return new Set<number>()
  }, [current, possibleMoves, selectedValues])

  return (
    <div className='h-screen'>
      <Head>
        <title>Shut the Box</title>
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <main className='p-4'>
        {current.matches('lobby') ? (
          <button onClick={start}>Start</button>
        ) : null}
        {current.matches('play') ? (
          <section className='flex flex-col justify-between items-center'>
            <button disabled={!current.matches('play.waiting')} onClick={roll}>
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
                  onClick={submitMove}
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
                          deselectValue(choice)
                        } else {
                          selectValue(choice)
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
                <button onClick={retry}>Play Again</button>
              </section>
            ) : null}
            {current.matches('play.win') ? (
              <section>
                <div>You won! 😆</div>
                <button onClick={retry}>Play Again</button>
              </section>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  )
}

function ThreeDimensionalButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
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
