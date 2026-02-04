/**
 * HeroSection - Landing page hero with CTA
 *
 * Marketing section showcasing the game concept with live Bitcoin price display.
 * Primary conversion point for unauthenticated visitors.
 */

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button/Button'
import { Badge } from '@/components/ui/badge/Badge'
import { ArrowRight, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { PriceTickerCard } from '@/components/features/price-snapshot/PriceTickerCard'
import { BitcoinIcon } from '@/components/icons/BitcoinIcon'
import styles from './HeroSection.module.scss'

interface HighlightProps {
  className: string
  Icon: React.JSXElementConstructor<{ className?: string }>
  children: React.ReactNode
}

function Highlight({ className, Icon, children }: HighlightProps) {
  return (
    <span className={className}>
      <Icon className={styles.highlightIcon} />
      {children}
    </span>
  )
}
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
            {t.rich('subtitle', {
              higher: (chunks) => (
                <Highlight className={styles.higher} Icon={TrendingUp}>
                  {chunks}
                </Highlight>
              ),
              lower: (chunks) => (
                <Highlight className={styles.lower} Icon={TrendingDown}>
                  {chunks}
                </Highlight>
              ),
            })}
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
