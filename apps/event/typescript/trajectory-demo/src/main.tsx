import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EventTrajectory } from '@runfold/trajectory-ui'
import { demoEvents } from './demo-events.js'
import './page.css'

document.body.dataset.dsDarkTheme = ''

function App() {
  const requested = Number(new URLSearchParams(window.location.search).get('events') ?? 0)
  return <EventTrajectory events={demoEvents(requested)} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
