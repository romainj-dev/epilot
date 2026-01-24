# Price Snapshot Scheduler

The scheduler is a Step Functions Express state machine that invokes
`priceSnapshotJob` in a loop. Control it with SSM parameters:

- `/epilot/<env>/price-snapshot-enabled` set to `true` or `false`
- `/epilot/<env>/price-snapshot-interval-seconds` number of seconds to wait
- `/epilot/<env>/coingecko-api-key` CoinGecko API key (SecureString)

To stop the job, set the `price-snapshot-enabled` parameter to `false`.
To restart it, set it back to `true` and start a new execution of the
state machine in the AWS console.
