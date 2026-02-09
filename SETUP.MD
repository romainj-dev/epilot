# Developer Setup Guide

This guide walks you through bootstrapping the app with your own AWS account.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** (LTS version, v20+)
- **pnpm** - Install via `npm install -g pnpm`
- **AWS CLI** - [Install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **Amplify CLI (Gen1)** - Install via `npm install -g @aws-amplify/cli@12`
- **AWS Account** (free tier is sufficient)
- **CoinGecko Account** - [Sign up for a Demo account](https://www.coingecko.com/en/api) to get an API key

> **Note**: This project uses Amplify Gen1 (classic), not Gen2. Gen1 uses CloudFormation templates and the `amplify add/push` workflow. If you have Gen2 installed, you may need to install Gen1 separately or use version 12.x of the CLI.

Configure AWS CLI with your credentials:

```bash
aws configure
```

## 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd bigbet
pnpm install
```

## 2. Prepare for Fresh AWS Deployment

This repository should **not** commit `amplify/team-provider-info.json`. If it exists (from a previous init), delete it before initializing Amplify with your own account.

### 2.1 (Optional) Project name

You can rename the Amplify project before initializing in `amplify/.config/project-config.json`. This affects Amplify stack names; the SSM prefix used by this project remains `bigbet`.

## 3. Initialize Amplify

Run the Amplify init command:

```bash
amplify init
```

You'll be prompted with questions:

| Prompt                                    | Recommended Answer                       |
| ----------------------------------------- | ---------------------------------------- |
| Enter a name for the environment          | `dev-a` (use a unique env per instance)  |
| Choose your default editor                | Your preference                    |
| Select the authentication method          | `AWS profile` (recommended)        |
| Please choose the profile you want to use | Select your configured AWS profile |

Amplify will create the necessary IAM roles and S3 bucket for deployments.

## 4. Deploy AWS Resources

Push all backend resources to AWS:

```bash
amplify push
```

You'll be prompted with questions:

| Prompt                                    | Answer                 |
| ----------------------------------------- | ---------------------------------- |
| Do you want to generate code for your newly created GraphQL API?         | No |


This creates:

- **Cognito User Pool** - User authentication
- **AppSync GraphQL API** - API layer with DynamoDB resolvers
- **DynamoDB Tables** - Data storage
- **Lambda Functions** - `bigbetAuthPostConfirmation`, `priceSnapshotJob`
- **Step Functions State Machine** - Price snapshot scheduler

Wait for the deployment to complete (5-10 minutes).

## 5. Configure Local Environment

Create a `.env.local` file in the project root
Copy-paste .env.example

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<generate-a-random-string>

# AWS Region (must match your Amplify deployment)
AWS_REGION=<your-region>

# Cognito (from step 6.3)
COGNITO_CLIENT_ID=<your-cognito-client-id>

# AppSync (from steps 6.1 and 6.2)
APPSYNC_ENDPOINT=<your-appsync-endpoint>
APPSYNC_API_KEY=<your-appsync-api-key>
```

Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```

## 6. Gather AWS Resource Values

After deployment, you need to collect several values from the AWS Console.

### 6.1 AppSync Endpoint

1. Open [AWS AppSync Console](https://console.aws.amazon.com/appsync/)
2. Select your API (named like `bigbet-{env}`)
3. Go to **Settings** in the left sidebar
4. Copy the **API URL** (looks like `https://xxxxx.appsync-api.region.amazonaws.com/graphql`)
5. Set APPSYNC_ENDPOINT in your .env.local

### 6.2 AppSync API Key

> **Important**: API keys are only visible at creation time!

1. In the AppSync Console, go to **Settings**
2. Scroll to **Additional authorization modes** section
3. Select the Api key or Click **Create API Key**
4. Set APPSYNC_API_KEY in your .env.local


### 6.3 Cognito User Pool Client ID

1. Open [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Click **User pools**
3. Select your pool (named like `bigbet_userpool-{env}`)
4. Go to **Applications > App client**
5. Copy the **Client ID** (not the Client Secret) of **{...}_clientWeb**
6. Set COGNITO_CLIENT_ID in your .env.local

## 7. Seed SSM Parameters

The Lambda functions read configuration from AWS Systems Manager Parameter Store. You need to create these parameters.

1. Open [AWS Systems Manager Console](https://console.aws.amazon.com/systems-manager/)
2. Go to **Parameter Store** in the left sidebar
3. Create each parameter below (some might have been created automatically):

### Required Parameters

| Name                                          | Type         | Value                                       |
| --------------------------------------------- | ------------ | ------------------------------------------- |
| `/bigbet/{env}/appsync-endpoint`              | String       | Your AppSync GraphQL endpoint from step 5.1 |
| `/bigbet/{env}/appsync-api-key`               | SecureString | Your AppSync API key from step 5.2          |
| `/bigbet/{env}/coingecko-api-key`             | SecureString | Your CoinGecko API key                      |
| `/bigbet/{env}/price-snapshot-enabled`        | String       | `true`                                      |
| `/bigbet/{env}/price-snapshot-interval-seconds` | String     | `60`                                        |

> **Note**: Replace `dev` with your environment name if you used something different in step 3.

### Creating Parameters via CLI

```bash
# AppSync GraphQL endpoint (from step 6.1)
aws ssm put-parameter \
  --name "/bigbet/${env}/appsync-endpoint" \
  --type "String" \
  --value "<your-appsync-graphql-endpoint>" \
  --overwrite

# AppSync API key (from step 6.2)
aws ssm put-parameter \
  --name "/bigbet/${env}/appsync-api-key" \
  --type "SecureString" \
  --value "<your-appsync-api-key>" \
  --overwrite

# CoinGecko API key (from your CoinGecko account)
aws ssm put-parameter \
  --name "/bigbet/${env}/coingecko-api-key" \
  --type "SecureString" \
  --value "<your-coingecko-api-key>" \
  --overwrite

# Enable price snapshots
aws ssm put-parameter \
  --name "/bigbet/${env}/price-snapshot-enabled" \
  --type "String" \
  --value "true" \
  --overwrite

# Snapshot interval (seconds)
aws ssm put-parameter \
  --name "/bigbet/${env}/price-snapshot-interval-seconds" \
  --type "String" \
  --value "60" \
  --overwrite
```

## 8. Start the Price Snapshot Scheduler

The price snapshot job runs via Step Functions. You need to start an execution:

0. Make sure `/bigbet/{env}/price-snapshot-enabled` is set to `true`
1. Open [AWS Step Functions Console](https://console.aws.amazon.com/states/)
2. Click **State machines**
3. Select the scheduler (named like `bigbet-priceSnapshotSchedulerStd-{env}`)
4. Click **Start execution** button (top right)
5. In the dialog, leave the input as `{}` or default
6. Click **Start execution** to confirm

The scheduler will now fetch Bitcoin prices every 60 seconds (or your configured interval - ssm param: price-snapshot-interval-seconds) and write `PriceSnapshot` entries via AppSync.

The web app receives updates via **Server-Sent Events** on `/api/price-snapshot/stream`. The Next.js BFF keeps a single AppSync subscription open and broadcasts new snapshots to connected clients.


> 🛑 **To stop the scheduler**: Set the SSM parameter `/bigbet/{env}/price-snapshot-enabled` to `false`. It will stop after its next iteration.

## 8.1 Guess Settlement Pipeline (EventBridge Scheduler)

Guess settlement is implemented as a one-shot schedule per guess:

- Settlement requires that `PriceSnapshot` data exists around the guess timestamps. If the price snapshot scheduler is not running, guesses may end up `FAILED` due to missing snapshots.

## 9. Enable USER_PASSWORD_AUTH flow

1. Open [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Click **User pools**
3. Select your pool (named like `bigbet_userpool-{env}`)
4. Go to **Applications > App client**
5. Select **{...}_clientWeb**
6. In the **Authentication flows** make sure `Username and password` is listed, if not add it:
7. Click **Edit**
8. Make sure `ALLOW_USER_PASSWORD_AUTH` is selected, and save changes

## 10. Run the App

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Verification Checklist

- [ ] Homepage loads without errors
- [ ] Can create a new account (check email for verification)
- [ ] Can log in
- [ ] BTC price displays and updates
- [ ] Can place a guess
- [ ] After placing a guess, a schedule appears in EventBridge Scheduler group `bigbet-guess-settlements-{env}`
- [ ] After `settleAt`, the guess becomes `SETTLED` and user score updates

## 11. Add test user to DB

1. Start the app
2. Go to http://localhost:3000
3. Signup a new user with the credentials of `cypress.config.ts` > **env**

### Verification Checklist

- [ ] Amplify tests (unit and integration) pass - `pnpm test:amplify`
- [ ] Web unit tests pass - `pnpm test:web`
- [ ] Cypress component tests pass - `pnpm cypress:component`
- [ ] Cypress e2e tests pass - `pnpm cypress:open` > **E2e tests**

## Troubleshooting

### "Missing APPSYNC_ENDPOINT or APPSYNC_API_KEY env var"

Your `.env.local` is missing required values. Double-check all variables are set.

### Price not updating

1. Check Step Functions execution is running (not failed/succeeded)
2. Verify SSM parameter `/bigbet/{env}/price-snapshot-enabled` is `true`
3. Check Lambda logs in CloudWatch for errors

### Guess never settles / no schedule created

1. Verify DynamoDB streams are enabled for the `Guess` table (Amplify `transform.conf.json` enables NEW_IMAGE).
2. Check `scheduleGuessLambda` CloudWatch logs for errors (permissions or invalid `settleAt` format).
3. In EventBridge Scheduler, confirm schedules are created under group `bigbet-guess-settlements-{env}`.

### Guess settles as FAILED (snapshots not found)

This means `settleGuessLambda` could not resolve a snapshot with `sourceUpdatedAt <= createdAt` and/or `sourceUpdatedAt <= settleAt`.

1. Ensure the price snapshot scheduler is running and writing `PriceSnapshot` rows.
2. Check that snapshot rows have `pk = "PriceSnapshot"` and `sourceUpdatedAt` populated.
3. Confirm there is at least one snapshot before the guess timestamps (createdAt/settleAt).

### Authentication errors

1. Verify `COGNITO_CLIENT_ID` matches the app client in Cognito Console
2. Ensure `AWS_REGION` matches your deployment region

### Lambda permission errors

The CloudFormation templates may contain hardcoded ARNs from the original developer's account. Check these files if you see IAM permission errors:

- `amplify/backend/function/bigbetAuthPostConfirmation/custom-policies.json`
- `amplify/backend/function/bigbetAuthPostConfirmation/bigbetAuthPostConfirmation-cloudformation-template.json`

These should use parameterized values like `${AWS::AccountId}` instead of hardcoded account IDs.

## Next Steps

- Review the [README](./README.md) for architecture details
- Explore the GraphQL schema in `amplify/backend/api/bigbet/schema.graphql`
- Check Lambda code in `amplify/backend/function/*/src/`

## Delete the app

Run the Amplify delete command:

```bash
amplify env remove
```
That will delete the CloudFormation stack for the env (and therefore most resources it created).

### Troubleshooting

- If CloudFormation can’t delete everything automatically, go to CloudFormation in your deployment region and delete the stack `amplify-{projectName}-{env}-...`.

- Typical blockers/leftovers to check:
- S3 buckets not empty (deployment bucket: `amplify-{projectName}-{env}-...-deployment`)
- CloudWatch Log Groups for Lambdas (sometimes retained)
- EventBridge Scheduler group `bigbet-guess-settlements-{env}` with leftover schedules
- SSM Parameters you created manually under `/bigbet/{env}/...` (Amplify won’t delete manual params)