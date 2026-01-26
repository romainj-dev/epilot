'use client'

import { useEffect, useRef } from 'react'
import styles from './AnimatedBackground.module.css'

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let time = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)

    // Grid lines that move
    const drawGrid = () => {
      const gridSize = 60
      const offsetY = (time * 15) % gridSize

      ctx.strokeStyle = 'rgba(100, 180, 255, 0.06)'
      ctx.lineWidth = 1

      // Vertical lines
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      // Horizontal lines (moving)
      for (
        let y = -gridSize + offsetY;
        y < canvas.height + gridSize;
        y += gridSize
      ) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    }

    // Floating particles
    const particles: Array<{
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      opacity: number
    }> = []

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5 - 0.2,
        opacity: Math.random() * 0.5 + 0.1,
      })
    }

    const drawParticles = () => {
      for (const particle of particles) {
        particle.x += particle.speedX
        particle.y += particle.speedY

        if (particle.x < 0) particle.x = canvas.width
        if (particle.x > canvas.width) particle.x = 0
        if (particle.y < 0) particle.y = canvas.height
        if (particle.y > canvas.height) particle.y = 0

        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59, 130, 246, ${particle.opacity})`
        ctx.fill()
      }
    }

    // Gradient mesh blobs
    const drawGradientMesh = () => {
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      // Electric blue blob
      const blob1X = centerX + Math.sin(time * 0.5) * 200
      const blob1Y = centerY + Math.cos(time * 0.3) * 150
      const gradient1 = ctx.createRadialGradient(
        blob1X,
        blob1Y,
        0,
        blob1X,
        blob1Y,
        400
      )
      gradient1.addColorStop(0, 'rgba(59, 130, 246, 0.18)')
      gradient1.addColorStop(0.5, 'rgba(59, 130, 246, 0.06)')
      gradient1.addColorStop(1, 'rgba(59, 130, 246, 0)')
      ctx.fillStyle = gradient1
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Ice/silver blob
      const blob2X = centerX + Math.cos(time * 0.4) * 250
      const blob2Y = centerY + Math.sin(time * 0.6) * 200
      const gradient2 = ctx.createRadialGradient(
        blob2X,
        blob2Y,
        0,
        blob2X,
        blob2Y,
        350
      )
      gradient2.addColorStop(0, 'rgba(148, 163, 184, 0.12)')
      gradient2.addColorStop(0.5, 'rgba(148, 163, 184, 0.04)')
      gradient2.addColorStop(1, 'rgba(148, 163, 184, 0)')
      ctx.fillStyle = gradient2
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Additional subtle blue accent blob
      const blob3X = centerX - Math.sin(time * 0.35) * 180
      const blob3Y = centerY - Math.cos(time * 0.45) * 220
      const gradient3 = ctx.createRadialGradient(
        blob3X,
        blob3Y,
        0,
        blob3X,
        blob3Y,
        300
      )
      gradient3.addColorStop(0, 'rgba(96, 165, 250, 0.1)')
      gradient3.addColorStop(1, 'rgba(96, 165, 250, 0)')
      ctx.fillStyle = gradient3
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const animate = () => {
      time += 0.016 // ~60fps

      // Clear with slight trail effect
      ctx.fillStyle = 'rgba(10, 10, 20, 0.95)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      drawGradientMesh()
      drawGrid()
      drawParticles()

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
