import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventTrajectory } from '@runfold/trajectory-ui'
import * as eventUi from '@runfold/trajectory-ui'
import { eventLog } from '../fixtures/event-log.js'

afterEach(cleanup)

describe('@runfold/trajectory-ui public trajectory', () => {
  it('exports only Runfold public names', () => {
    expect(Object.keys(eventUi)).toEqual(['EventTrajectory'])
    expect('DshTrajectory' in eventUi).toBe(false)
  })

  it('renders the trajectory toolbar, turns, and Event content', () => {
    render(<EventTrajectory events={eventLog()} />)

    expect(screen.getByRole('toolbar', { name: 'Trajectory toolbar' })).toBeTruthy()
    expect(screen.getByText('Turn 1')).toBeTruthy()
    expect(screen.getByText('Inspect the Event boundary.')).toBeTruthy()
    expect(screen.getAllByText('The Event boundary is intact.').length).toBeGreaterThan(0)
  })

  it('switches the complete interface to the requested locale', () => {
    render(<EventTrajectory events={eventLog(10)} locale="zh" />)

    expect(screen.getByRole('toolbar', { name: '轨迹工具栏' })).toBeTruthy()
    expect(screen.getByText('第 1 轮')).toBeTruthy()
  })

  it('routes older-history requests through the public callback', async () => {
    const loadOlder = vi.fn(async () => true)
    render(<EventTrajectory events={eventLog(10)} hasMore loadOlder={loadOlder} />)

    const controls = screen.getAllByRole('button', {
      name: /Load earlier history|Click to load earlier history/,
    })
    fireEvent.click(controls[0]!)
    await waitFor(() => { expect(loadOlder).toHaveBeenCalledOnce() })
  })

  it('reprojects when the immutable Event input changes', () => {
    const view = render(<EventTrajectory events={eventLog(10)} />)
    expect(screen.queryByText('Turn 2')).toBeNull()

    view.rerender(<EventTrajectory events={eventLog(20)} />)
    expect(screen.getByText('Turn 2')).toBeTruthy()
  })
})
