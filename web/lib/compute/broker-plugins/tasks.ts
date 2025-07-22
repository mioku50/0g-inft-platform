export function tasksPlugin() {
  return {
    name: 'tasks',
    async init(broker: any) {
      if (!broker.tasks && broker.fineTuning) {
        broker.tasks = broker.fineTuning
      }
    }
  }
}
