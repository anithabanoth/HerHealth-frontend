import test from 'node:test'
import assert from 'node:assert/strict'

import { createChatbotReply } from './chatbot.js'

test('explains a cycle estimate', () => {
  const response = createChatbotReply('What is my cycle?', {
    cycleEstimate: { cycleDay: 12, averageLength: 28, nextStart: '2026-10-20' },
  })

  assert.match(response, /Cycle day 12/)
  assert.match(response, /next period/i)
})

test('suggests a PCOD-friendly meal', () => {
  const response = createChatbotReply('What should I eat?', { cycleEstimate: null })

  assert.match(response, /protein|fiber|whole grains|vegetables/i)
})

test('supports appointment planning', () => {
  const response = createChatbotReply('I need to book an appointment', {
    appointments: [{ title: 'Consultation', appointmentDate: '2026-10-12' }],
  })

  assert.match(response, /appointment|consultation/i)
})

test('gives safe guidance for urgent symptoms', () => {
  const response = createChatbotReply('I have severe chest pain', {})

  assert.match(response, /emergency|urgent|medical care/i)
})
