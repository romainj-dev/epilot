import type { PriceSnapshotsByPkQuery } from '@/graphql/generated/graphql'

export type PriceSnapshotStream = NonNullable<
  NonNullable<PriceSnapshotsByPkQuery['priceSnapshotsByPk']>['items'][number]
>
