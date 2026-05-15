/**
 * useControllerNavigation.tsx
 *
 * React-style focus navigation driven by controller D-pad / left stick.
 * Wires into the existing DOM focus system by dispatching KeyboardEvents
 * (ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Enter/Space) so components that
 * already handle `tabIndex` + `onKeyDown` just work.
 */

import { useEffect, useRef, useCallback } from 'react'
import type { RawControllerState } from '../types/controller'

const DEADZONE = 0.3
const DPAD_THRESHOLD = 0.5

// Button indices per gcpad::Button enum
const BTN_A = 0
const BTN_B = 1
const BTN_X = 2
const BTN_Y = 3
const BTN_START = 4
const BTN_SELECT = 5
const BTN_GUIDE = 6
const BTN_L1 = 7
const BTN_R1 = 8
const BTN_L2 = 9
const BTN_R2 = 10
const BTN_L3 = 11
const BTN_R3 = 12
const BTN_DPAD_UP = 13
const BTN_DPAD_DOWN = 14
const BTN_DPAD_LEFT = 15
const BTN_DPAD_RIGHT = 16
const BTN_TOUCHPAD = 17

type Direction = 'up' | 'down' | 'left' | 'right'

export function useControllerNavigation(enabled = true) {
  const lastAxis = useRef({ x: 0, y: 0 })
  const lastButtons = useRef<Record<number, boolean>>({})
  const edgeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const focusActiveElement = useCallback(() => {
    const active = document.activeElement
    if (active && active !== document.body) return
    const firstFocusable = document.querySelector<HTMLElement>(
      '[tabindex]:not([tabindex="-1"]), button, a[href], input, select, textarea, [role="button"]'
    )
    firstFocusable?.focus()
  }, [])

  const dispatchNavKey = useCallback((direction: Direction) => {
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction]
    const event = new KeyboardEvent('keydown', {
      key, code: key, bubbles: true, cancelable: true, composed: true,
    })
    document.dispatchEvent(event)
  }, [])

  const handleInput = useCallback((state: RawControllerState) => {
    if (!enabled) return

    const buttons = state.buttons || []
    const axes = state.axes || []

    // D-pad via buttons (edge detection)
    for (const [btn, dir] of [[BTN_DPAD_UP, 'up'], [BTN_DPAD_DOWN, 'down'], [BTN_DPAD_LEFT, 'left'], [BTN_DPAD_RIGHT, 'right']] as const) {
      if (buttons[btn] && !lastButtons.current[btn]) {
        dispatchNavKey(dir)
      }
    }

    // Left stick axes for navigation (axes[0] = left/right, axes[1] = up/down)
    const lx = axes[0] ?? 0
    const ly = axes[1] ?? 0

    const wasInDeadzone = Math.abs(lastAxis.current.x) < DEADZONE && Math.abs(lastAxis.current.y) < DEADZONE
    const nowInDeadzone = Math.abs(lx) < DEADZONE && Math.abs(ly) < DEADZONE

    if (wasInDeadzone && !nowInDeadzone) {
      if (edgeDebounce.current) clearTimeout(edgeDebounce.current)
      edgeDebounce.current = setTimeout(() => {
        if (Math.abs(lx) > Math.abs(ly)) {
          if (lx < -DPAD_THRESHOLD) dispatchNavKey('left')
          else if (lx > DPAD_THRESHOLD) dispatchNavKey('right')
        } else {
          if (ly < -DPAD_THRESHOLD) dispatchNavKey('up')
          else if (ly > DPAD_THRESHOLD) dispatchNavKey('down')
        }
      }, 50)
    }

    lastAxis.current = { x: lx, y: ly }

    // A button = Enter (activate)
    if (buttons[BTN_A] && !lastButtons.current[BTN_A]) {
      dispatchNavKey('down')
    }

    // B button = Escape/Back
    if (buttons[BTN_B] && !lastButtons.current[BTN_B]) {
      const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
      document.dispatchEvent(event)
    }

    buttons.forEach((v, i) => { lastButtons.current[i] = v })
  }, [enabled, dispatchNavKey])

  useEffect(() => {
    if (!window.ucController?.onControllerInput) return
    const unsub = (window.ucController as any).onControllerInput(handleInput)
    return () => { if (unsub) unsub() }
  }, [handleInput])

  const focusRef = useRef<HTMLElement | null>(null)

  const focusFirst = useCallback(() => {
    if (!focusRef.current) return
    const first = focusRef.current.querySelector<HTMLElement>(
      '[tabindex]:not([tabindex="-1"]), button, a[href], input, select, textarea'
    )
    first?.focus()
  }, [])

  return { focusRef, focusFirst, enableControllerNav: focusActiveElement }
}

export default useControllerNavigation