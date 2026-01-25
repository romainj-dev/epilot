import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: [
    './src/graphql/aws-scalars.graphql',
    './amplify/backend/api/epilot/build/schema.graphql',
  ],
  documents: [
    'src/**/*.graphql',
    // Exclude the AWS scalars schema file (not a document)
    '!src/graphql/aws-scalars.graphql',
  ],
  generates: {
    './src/graphql/generated/': {
      preset: 'client',
      config: {
        scalars: {
          AWSDateTime: 'string',
          AWSEmail: 'string',
          AWSURL: 'string',
          AWSTimestamp: 'number',
          AWSDate: 'string',
          AWSTime: 'string',
          AWSPhone: 'string',
          AWSIPAddress: 'string',
          AWSJSON: 'string',
        },
      },
    },
  },
}

export default config
