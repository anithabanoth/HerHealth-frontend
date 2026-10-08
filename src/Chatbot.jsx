import { useEffect, useRef, useState } from 'react'
import { createChatbotReply } from './chatbot.js'

export default function Chatbot({ account, cycleEstimate, appointments }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I can help with your cycle, meals, wellness, and appointments.' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function sendMessage(event) {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || sending) return

    const userMessage = { role: 'user', text: trimmed }
    setMessages((previous) => [...previous, userMessage])
    setInput('')
    setSending(true)

    setTimeout(() => {
      setMessages((previous) => [
        ...previous,
        { role: 'assistant', text: createChatbotReply(trimmed, { account, cycleEstimate, appointments }) },
      ])
      setSending(false)
    }, 350)
  }

  return (
    <div className="chatbot-widget">
      <button
        type="button"
        className="chatbot-toggle"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls="herhealth-chatbot"
      >
        <span className="chatbot-icon" aria-hidden="true">✦</span>
        <span>HerHealth Assistant</span>
      </button>

      {open && (
        <section id="herhealth-chatbot" className="chatbot-panel" aria-label="HerHealth assistant">
          <div className="chatbot-header">
            <div>
              <strong>HerHealth Assistant</strong>
              <small>Wellness guidance only</small>
            </div>
            <button type="button" className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </div>

          <div className="chatbot-messages" role="log" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chatbot-message ${message.role}`}>
                <span>{message.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form className="chatbot-form" onSubmit={sendMessage}>
            <label htmlFor="chatbot-input" className="visually-hidden">Type your message</label>
            <input
              id="chatbot-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your health..."
              autoComplete="off"
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()}>{sending ? '...' : 'Send'}</button>
          </form>
        </section>
      )}
    </div>
  )
}
