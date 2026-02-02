import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card/Card'
import styles from './GuessHistoryContainer.module.scss'
import { useTranslations } from 'next-intl'

interface GuessHistoryContainerProps {
  children: React.ReactElement
}

export function GuessHistoryContainer({
  children,
}: GuessHistoryContainerProps) {
  const t = useTranslations('dashboardGuessHistory')

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.cardTitle}>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
