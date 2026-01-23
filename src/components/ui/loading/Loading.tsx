import { Loader2 } from 'lucide-react'
import styles from './Loading.module.scss'

export function Loading() {
  return <Loader2 className={styles.spinnerIcon} />
}
