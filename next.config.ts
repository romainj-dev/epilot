import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'

const nextConfig: NextConfig = {
  reactCompiler: true,
  sassOptions: {
    loadPaths: [path.join(process.cwd(), 'src/styles')],
    additionalData: `@use 'theme' as theme;`,
  },
}

const withNextIntl = createNextIntlPlugin()

export default withNextIntl(nextConfig)
