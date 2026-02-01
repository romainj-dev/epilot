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
    <div className={styles.field}>
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
