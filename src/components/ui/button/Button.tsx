'use client'

import * as React from 'react'
import styles from './Button.module.scss'
import type { ComponentProps, ReactNode } from 'react'
import { Button as ButtonUi } from '@/components/ui/base/button'
import { Loading } from '@/components/ui/loading/Loading'
import { cn } from '@/lib/utils'

interface ButtonContentProps {
  children: ReactNode
  isLoading: boolean
}
function ButtonContent({ children, isLoading }: ButtonContentProps) {
  return (
    <>
      <span className={cn(styles.content, isLoading && styles.contentHidden)}>
        {children}
      </span>
      {isLoading && (
        <span className={styles.loading}>
          <Loading />
        </span>
      )}
    </>
  )
}

/**
 * With asChild the child element itself must be the thing you want styled
 * Clone to keep the child element (e.g. Link/a) while wrapping its contents.
 */
function getContentAsChildContent({
  children,
  isLoading,
}: {
  children: ReactNode
  isLoading: boolean
}) {
  if (!React.isValidElement<{ children?: ReactNode }>(children)) {
    throw new Error('Children must be a valid React element')
  }

  return React.cloneElement(children, {
    children: (
      <ButtonContent isLoading={isLoading}>
        {children.props.children}
      </ButtonContent>
    ),
  })
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'
  asChild?: boolean
  isLoading?: boolean
}

export function Button({
  variant = 'default',
  size = 'default',
  asChild = false,
  isLoading = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonUi
      variant={variant}
      size={size}
      asChild={asChild}
      className={cn(styles.button, className)}
      {...props}
    >
      {asChild ? (
        getContentAsChildContent({ children, isLoading })
      ) : (
        <ButtonContent isLoading={isLoading}>{children}</ButtonContent>
      )}
    </ButtonUi>
  )
}
