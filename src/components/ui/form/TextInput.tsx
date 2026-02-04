/**
 * TextInput - Labeled form input with optional hint text
 *
 * Consistent form field wrapper for all text-based inputs.
 * Provides accessible label-input association and error/hint display.
 */

import { Input } from '@/components/ui/base/input'
import type { ComponentProps, HTMLInputTypeAttribute } from 'react'
import styles from './TextInput.module.scss'

interface TextInputProps extends ComponentProps<'input'> {
  id: string
  label: string
  type?: HTMLInputTypeAttribute
  hint?: string
}

export function TextInput({
  id,
  label,
  type = 'text',
  hint,
  ...props
}: TextInputProps) {
  return (
    <div className={styles.field} data-testid={`${id}-field`}>
      <label htmlFor={id} className={styles.label} data-testid={`${id}-label`}>
        {label}
      </label>
      <Input id={id} type={type} data-testid={id} {...props} />
      {hint && (
        <p className={styles.hint} data-testid={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  )
}
