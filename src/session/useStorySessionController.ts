import { useEffect, useMemo, useSyncExternalStore } from 'react'

import type { StorySessionControllerDependencies } from './storySessionController'
import { createStorySessionController } from './storySessionController'

export function useStorySessionController(dependencies: StorySessionControllerDependencies) {
  const controller = useMemo(
    () => createStorySessionController(dependencies),
    [dependencies],
  )
  const subscribe = useMemo(() => controller.subscribe.bind(controller), [controller])
  const getState = useMemo(() => controller.state.bind(controller), [controller])
  const state = useSyncExternalStore(
    subscribe,
    getState,
    getState,
  )

  useEffect(() => {
    controller.refresh()
    const interval = setInterval(() => controller.refresh(), 250)
    return () => {
      clearInterval(interval)
      void controller.stop()
    }
  }, [controller])

  return {
    controller,
    state,
    snapshot: controller.snapshot(),
    beginStory: controller.beginStory.bind(controller),
    pauseOrResume: controller.pauseOrResume.bind(controller),
    stop: controller.stop.bind(controller),
  }
}
