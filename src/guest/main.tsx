import React from 'react'
import ReactDOM from 'react-dom/client'
import GuestApp from './GuestApp'
import './guest.less'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GuestApp />
  </React.StrictMode>,
)
