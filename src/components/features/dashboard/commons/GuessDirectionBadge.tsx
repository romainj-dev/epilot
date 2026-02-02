import { GuessDirection } from '@/graphql/generated/graphql'
import { Badge } from '@/components/ui/badge/Badge'
import { ArrowUp, ArrowDown, type LucideIcon } from 'lucide-react'
import styles from './GuessDirectionBadge.module.scss'
import { useTranslations } from 'next-intl'

const DIRECTION_ICONS: Record<GuessDirection, LucideIcon> = {
  [GuessDirection.Up]: ArrowUp,
  [GuessDirection.Down]: ArrowDown,
} as const

interface GuessDirectionBadgeProps {
  direction: GuessDirection
}

export function GuessDirectionBadge({ direction }: GuessDirectionBadgeProps) {
  const t = useTranslations('dashboardDirectionBadge')
  const Icon = DIRECTION_ICONS[direction]
  const label = direction === GuessDirection.Up ? t('up') : t('down')

  return (
    <Badge
      variant="outline"
      className={styles.badge}
      data-direction={direction.toLowerCase()}
    >
      <Icon className={styles.icon} />
      {label}
    </Badge>
  )
}
