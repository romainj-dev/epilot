import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button/Button'
import { Badge } from '@/components/ui/badge/Badge'
import { ArrowRight, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { PriceTickerCard } from '@/components/features/price-snapshot/PriceTickerCard'
import { BitcoinIcon } from '@/components/icons/BitcoinIcon'
import styles from './HeroSection.module.scss'

export function HeroSection() {
  const t = useTranslations('homePage.hero')

  return (
    <section className={styles.section}>
      {/* Bitcoin watermark */}
      <div className={styles.watermark}>
        <BitcoinIcon className={styles.watermarkIcon} />
      </div>

      <div className={styles.container}>
        <div className={styles.content}>
          {/* Badge */}
          <Badge variant="outline" className={styles.badge}>
            <Zap className="mr-1 size-3" />
            {t('badge')}
          </Badge>

          {/* Main headline */}
          <h1 className={styles.headline}>
            <span className={styles.headlineMain}>{t('headline.main')}</span>
            <br />
            <span className={styles.headlineGradient}>
              {t('headline.emphasis')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className={styles.subtitle}>
            {t('subtitle.lead')}{' '}
            <span className={styles.higher}>
              <TrendingUp className={styles.trendIcon} />
              {t('subtitle.higher')}
            </span>{' '}
            {t('subtitle.or')}{' '}
            <span className={styles.lower}>
              <TrendingDown className={styles.trendIcon} />
              {t('subtitle.lower')}
            </span>{' '}
            {t('subtitle.tail')}
          </p>

          {/* Live price mockup */}
          <PriceTickerCard />

          {/* CTA button */}
          <div className={styles.ctaButtons}>
            <Button size="lg" asChild color="primary">
              <Link href="/dashboard">
                {t('cta')}
                <ArrowRight className={styles.primaryCtaIcon} />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className={styles.bottomFade} />
    </section>
  )
}
