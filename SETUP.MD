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
cd epilot
pnpm install
```

## 2. Prepare for Fresh AWS Deployment

The repository contains `amplify/team-provider-info.json` with the original developer's AWS account references. You must delete this file before initializing Amplify with your own account:

```bash
rm amplify/team-provider-info.json
```

## 3. Initialize Amplify

Run the Amplify init command:

```bash
amplify init
```

You'll be prompted with questions:

| Prompt                                    | Recommended Answer                 |
| ----------------------------------------- | ---------------------------------- |
| Enter a name for the environment          | `dev` (or your preferred env name) |
| Choose your default editor                | Your preference                    |
| Select the authentication method          | `AWS profile` (recommended)        |
| Please choose the profile you want to use | Select your configured AWS profile |

Amplify will create the necessary IAM roles and S3 bucket for deployments.

## 4. Deploy AWS Resources

Push all backend resources to AWS:

```bash
amplify push
```

This creates:

- **Cognito User Pool** - User authentication
- **AppSync GraphQL API** - API layer with DynamoDB resolvers
- **DynamoDB Tables** - Data storage
- **Lambda Functions** - `epilotAuthPostConfirmation`, `priceSnapshotJob`
- **Step Functions State Machine** - Price snapshot scheduler

Wait for the deployment to complete (5-10 minutes).

## 5. Gather AWS Resource Values

After deployment, you need to collect several values from the AWS Console.

### 5.1 AppSync Endpoint

1. Open [AWS AppSync Console](https://console.aws.amazon.com/appsync/)
2. Select your API (named like `epilot-dev`)
3. Go to **Settings** in the left sidebar
4. Copy the **API URL** (looks like `https://xxxxx.appsync-api.region.amazonaws.com/graphql`)

### 5.2 AppSync API Key

> **Important**: API keys are only visible at creation time!

1. In the AppSync Console, go to **Settings**
2. Scroll to **API Keys** section
3. Click **Create API Key**
4. Set an expiration date (max 365 days)
5. **Copy the key immediately** - you won't be able to see it again

### 5.3 Cognito User Pool Client ID

1. Open [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Click **User pools**
3. Select your pool (named like `epilotAuth-dev`)
4. Go to **App integration** tab
5. Scroll to **App clients and analytics**
6. Copy the **Client ID** (not the Client Secret)

## 6. Seed SSM Parameters

The Lambda functions read configuration from AWS Systems Manager Parameter Store. You need to create these parameters.

1. Open [AWS Systems Manager Console](https://console.aws.amazon.com/systems-manager/)
2. Go to **Parameter Store** in the left sidebar
3. Create each parameter below:

### Required Parameters

| Name                                          | Type         | Value                                       |
| --------------------------------------------- | ------------ | ------------------------------------------- |
| `/epilot/dev/appsync-endpoint`                | String       | Your AppSync GraphQL endpoint from step 5.1 |
| `/epilot/dev/appsync-api-key`                 | SecureString | Your AppSync API key from step 5.2          |
| `/epilot/dev/coingecko-api-key`               | SecureString | Your CoinGecko API key                      |
| `/epilot/dev/price-snapshot-enabled`          | String       | `true`                                      |
| `/epilot/dev/price-snapshot-interval-seconds` | String       | `60`                                        |

> **Note**: Replace `dev` with your environment name if you used something different in step 3.

### Creating Parameters via CLI

```bash
ENV=dev

# AppSync GraphQL endpoint (from step 5.1)
aws ssm put-parameter \
  --name "/epilot/${ENV}/appsync-endpoint" \
  --type "String" \
  --value "<your-appsync-graphql-endpoint>" \
  --overwrite

# AppSync API key (from step 5.2)
aws ssm put-parameter \
  --name "/epilot/${ENV}/appsync-api-key" \
  --type "SecureString" \
  --value "<your-appsync-api-key>" \
  --overwrite

# CoinGecko API key (from your CoinGecko account)
aws ssm put-parameter \
  --name "/epilot/${ENV}/coingecko-api-key" \
  --type "SecureString" \
  --value "<your-coingecko-api-key>" \
  --overwrite

# Enable price snapshots
aws ssm put-parameter \
  --name "/epilot/${ENV}/price-snapshot-enabled" \
  --type "String" \
  --value "true" \
  --overwrite

# Snapshot interval (seconds)
aws ssm put-parameter \
  --name "/epilot/${ENV}/price-snapshot-interval-seconds" \
  --type "String" \
  --value "60" \
  --overwrite
```

## 7. Configure Local Environment

Create a `.env.local` file in the project root:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<generate-a-random-string>

# AWS Region (must match your Amplify deployment)
AWS_REGION=<your-region>

# Cognito (from step 5.3)
COGNITO_CLIENT_ID=<your-cognito-client-id>

# AppSync (from steps 5.1 and 5.2)
APPSYNC_ENDPOINT=<your-appsync-endpoint>
APPSYNC_API_KEY=<your-appsync-api-key>
```

Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```

## 8. Start the Price Snapshot Scheduler

The price snapshot job runs via Step Functions. You need to start an execution:

1. Open [AWS Step Functions Console](https://console.aws.amazon.com/states/)
2. Click **State machines**
3. Select the scheduler (named like `priceSnapshotScheduler-dev`)
4. Click **Start execution** button (top right)
5. In the dialog, leave the input as `{}` or default
6. Click **Start execution** to confirm

The scheduler will now poll Bitcoin prices every 60 seconds (or your configured interval - ssm param: price-snapshot-interval-seconds).

> 🛑 **To stop the scheduler**: Set the SSM parameter `/epilot/dev/price-snapshot-enabled` to `false`. The scheduler will stop after its next iteration.
>
> ```bash
> aws ssm put-parameter --name "/epilot/dev/price-snapshot-enabled" --type "String" --value "false" --overwrite
> ```

## 9. Run the App

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Verification Checklist

- [ ] Homepage loads without errors
- [ ] Can create a new account (check email for verification)
- [ ] Can log in
- [ ] BTC price displays and updates
- [ ] Can place a guess

## Troubleshooting

### "Missing APPSYNC_ENDPOINT or APPSYNC_API_KEY env var"

Your `.env.local` is missing required values. Double-check all variables are set.

### Price not updating

1. Check Step Functions execution is running (not failed/succeeded)
2. Verify SSM parameter `/epilot/dev/price-snapshot-enabled` is `true`
3. Check Lambda logs in CloudWatch for errors

### Authentication errors

1. Verify `COGNITO_CLIENT_ID` matches the app client in Cognito Console
2. Ensure `AWS_REGION` matches your deployment region

### Lambda permission errors

The CloudFormation templates may contain hardcoded ARNs from the original developer's account. Check these files if you see IAM permission errors:

- `amplify/backend/function/epilotAuthPostConfirmation/custom-policies.json`
- `amplify/backend/function/epilotAuthPostConfirmation/epilotAuthPostConfirmation-cloudformation-template.json`

These should use parameterized values like `${AWS::AccountId}` instead of hardcoded account IDs.

## Next Steps

- Review the [README](./README.md) for architecture details
- Explore the GraphQL schema in `amplify/backend/api/epilot/schema.graphql`
- Check Lambda code in `amplify/backend/function/*/src/`
