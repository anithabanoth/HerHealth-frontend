const urgentKeywords = ['chest pain', 'severe bleeding', 'fainting', 'shortness of breath', 'severe headache', 'suicidal'];

export function createChatbotReply(message, context = {}) {
  const text = message.trim().toLowerCase();

  if (urgentKeywords.some((keyword) => text.includes(keyword))) {
    return 'This may be an emergency. Seek urgent medical care now or contact emergency services. If you are in immediate danger, call your local emergency number. Do not drive yourself unless someone can safely take you.';
  }

  if (text.includes('cycle') || text.includes('period')) {
    const estimate = context.cycleEstimate;
    if (estimate) {
      return `Cycle day ${estimate.cycleDay}. Your estimated average cycle length is ${estimate.averageLength} days, and your next period is expected around ${estimate.nextStart}. Track bleeding, pain, and symptoms in the Daily log.`;
    }
    return 'I can help you track your cycle. Add your period start date in Cycle, then the app can estimate your next period.';
  }

  if (text.includes('meal') || text.includes('eat') || text.includes('diet') || text.includes('food')) {
    return 'Aim for balanced meals with protein, fiber, whole grains, vegetables, and healthy fats. Keep portions simple, hydrate regularly, and avoid skipping meals. For PCOS-related symptoms, regular meals and low-sugar choices may help some people feel more stable.';
  }

  if (text.includes('appointment') || text.includes('doctor') || text.includes('consult')) {
    const appointments = context.appointments || [];
    if (appointments.length > 0) {
      const next = appointments[0];
      return `You have an appointment for ${next.title} on ${next.appointmentDate}. You can review or update it in Appointments.`;
    }
    return 'You do not have any saved appointments yet. Use Appointments to add one and include the date, time, and reason.';
  }

  if (text.includes('wellness') || text.includes('mood') || text.includes('sleep') || text.includes('exercise')) {
    return 'Try to notice patterns in your sleep, hydration, exercise, mood, and symptoms. Consistency is more important than perfection, and your Daily log can help you spot changes over time.';
  }

  if (text.includes('hello') || text.includes('hi')) {
    return 'Hello! I can help with your cycle, wellness habits, meals, appointments, and general health questions. What would you like to explore?';
  }

  return 'I can help with HerHealth cycle tracking, daily wellness habits, meal ideas, and appointments. Ask me about your cycle, symptoms, meals, or upcoming appointments.';
}
