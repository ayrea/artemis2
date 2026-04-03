import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

type InvalidatorProps = {
  currentTime: Date
}

export default function Invalidator({ currentTime }: InvalidatorProps) {
  const { invalidate } = useThree()

  useEffect(() => {
    invalidate()
  }, [currentTime, invalidate])

  return null
}
