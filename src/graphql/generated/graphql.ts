/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  AWSDate: { input: string; output: string; }
  AWSDateTime: { input: string; output: string; }
  AWSEmail: { input: string; output: string; }
  AWSIPAddress: { input: string; output: string; }
  AWSJSON: { input: string; output: string; }
  AWSPhone: { input: string; output: string; }
  AWSTime: { input: string; output: string; }
  AWSTimestamp: { input: number; output: number; }
  AWSURL: { input: string; output: string; }
};

export type CreateGuessInput = {
  createdAt?: InputMaybe<Scalars['AWSDateTime']['input']>;
  direction: GuessDirection;
  endPrice?: InputMaybe<Scalars['Float']['input']>;
  endPriceSnapshotId?: InputMaybe<Scalars['ID']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  outcome?: InputMaybe<GuessOutcome>;
  owner?: InputMaybe<Scalars['String']['input']>;
  result?: InputMaybe<GuessDirection>;
  settleAt: Scalars['AWSDateTime']['input'];
  startPrice?: InputMaybe<Scalars['Float']['input']>;
  startPriceSnapshotId?: InputMaybe<Scalars['ID']['input']>;
  status: GuessStatus;
};

export type CreatePriceSnapshotInput = {
  capturedAt: Scalars['AWSDateTime']['input'];
  id?: InputMaybe<Scalars['ID']['input']>;
  pk: Scalars['String']['input'];
  priceUsd: Scalars['Float']['input'];
  source?: InputMaybe<Scalars['String']['input']>;
  sourceUpdatedAt?: InputMaybe<Scalars['AWSDateTime']['input']>;
};

export type CreateUserStateInput = {
  email: Scalars['AWSEmail']['input'];
  id?: InputMaybe<Scalars['ID']['input']>;
  lastUpdatedAt: Scalars['AWSDateTime']['input'];
  owner: Scalars['String']['input'];
  score: Scalars['Int']['input'];
  streak: Scalars['Int']['input'];
  username: Scalars['String']['input'];
};

export type DeleteGuessInput = {
  id: Scalars['ID']['input'];
};

export type DeletePriceSnapshotInput = {
  id: Scalars['ID']['input'];
};

export type DeleteUserStateInput = {
  id: Scalars['ID']['input'];
};

export type Guess = {
  __typename?: 'Guess';
  createdAt: Scalars['AWSDateTime']['output'];
  direction: GuessDirection;
  endPrice?: Maybe<Scalars['Float']['output']>;
  endPriceSnapshotId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  outcome?: Maybe<GuessOutcome>;
  owner?: Maybe<Scalars['String']['output']>;
  result?: Maybe<GuessDirection>;
  settleAt: Scalars['AWSDateTime']['output'];
  startPrice?: Maybe<Scalars['Float']['output']>;
  startPriceSnapshotId?: Maybe<Scalars['ID']['output']>;
  status: GuessStatus;
  updatedAt: Scalars['AWSDateTime']['output'];
};

export enum GuessDirection {
  Down = 'DOWN',
  Up = 'UP'
}

export enum GuessOutcome {
  Loss = 'LOSS',
  Win = 'WIN'
}

export enum GuessStatus {
  Failed = 'FAILED',
  Pending = 'PENDING',
  Settled = 'SETTLED'
}

export enum ModelAttributeTypes {
  Null = '_null',
  Binary = 'binary',
  BinarySet = 'binarySet',
  Bool = 'bool',
  List = 'list',
  Map = 'map',
  Number = 'number',
  NumberSet = 'numberSet',
  String = 'string',
  StringSet = 'stringSet'
}

export type ModelBooleanInput = {
  attributeExists?: InputMaybe<Scalars['Boolean']['input']>;
  attributeType?: InputMaybe<ModelAttributeTypes>;
  eq?: InputMaybe<Scalars['Boolean']['input']>;
  ne?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ModelFloatInput = {
  attributeExists?: InputMaybe<Scalars['Boolean']['input']>;
  attributeType?: InputMaybe<ModelAttributeTypes>;
  between?: InputMaybe<Array<InputMaybe<Scalars['Float']['input']>>>;
  eq?: InputMaybe<Scalars['Float']['input']>;
  ge?: InputMaybe<Scalars['Float']['input']>;
  gt?: InputMaybe<Scalars['Float']['input']>;
  le?: InputMaybe<Scalars['Float']['input']>;
  lt?: InputMaybe<Scalars['Float']['input']>;
  ne?: InputMaybe<Scalars['Float']['input']>;
};

export type ModelGuessConditionInput = {
  and?: InputMaybe<Array<InputMaybe<ModelGuessConditionInput>>>;
  createdAt?: InputMaybe<ModelStringInput>;
  direction?: InputMaybe<ModelGuessDirectionInput>;
  endPrice?: InputMaybe<ModelFloatInput>;
  endPriceSnapshotId?: InputMaybe<ModelIdInput>;
  not?: InputMaybe<ModelGuessConditionInput>;
  or?: InputMaybe<Array<InputMaybe<ModelGuessConditionInput>>>;
  outcome?: InputMaybe<ModelGuessOutcomeInput>;
  owner?: InputMaybe<ModelStringInput>;
  result?: InputMaybe<ModelGuessDirectionInput>;
  settleAt?: InputMaybe<ModelStringInput>;
  startPrice?: InputMaybe<ModelFloatInput>;
  startPriceSnapshotId?: InputMaybe<ModelIdInput>;
  status?: InputMaybe<ModelGuessStatusInput>;
  updatedAt?: InputMaybe<ModelStringInput>;
};

export type ModelGuessConnection = {
  __typename?: 'ModelGuessConnection';
  items: Array<Maybe<Guess>>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type ModelGuessDirectionInput = {
  eq?: InputMaybe<GuessDirection>;
  ne?: InputMaybe<GuessDirection>;
};

export type ModelGuessFilterInput = {
  and?: InputMaybe<Array<InputMaybe<ModelGuessFilterInput>>>;
  createdAt?: InputMaybe<ModelStringInput>;
  direction?: InputMaybe<ModelGuessDirectionInput>;
  endPrice?: InputMaybe<ModelFloatInput>;
  endPriceSnapshotId?: InputMaybe<ModelIdInput>;
  id?: InputMaybe<ModelIdInput>;
  not?: InputMaybe<ModelGuessFilterInput>;
  or?: InputMaybe<Array<InputMaybe<ModelGuessFilterInput>>>;
  outcome?: InputMaybe<ModelGuessOutcomeInput>;
  owner?: InputMaybe<ModelStringInput>;
  result?: InputMaybe<ModelGuessDirectionInput>;
  settleAt?: InputMaybe<ModelStringInput>;
  startPrice?: InputMaybe<ModelFloatInput>;
  startPriceSnapshotId?: InputMaybe<ModelIdInput>;
  status?: InputMaybe<ModelGuessStatusInput>;
  updatedAt?: InputMaybe<ModelStringInput>;
};

export type ModelGuessOutcomeInput = {
  eq?: InputMaybe<GuessOutcome>;
  ne?: InputMaybe<GuessOutcome>;
};

export type ModelGuessStatusInput = {
  eq?: InputMaybe<GuessStatus>;
  ne?: InputMaybe<GuessStatus>;
};

export type ModelIdInput = {
  attributeExists?: InputMaybe<Scalars['Boolean']['input']>;
  attributeType?: InputMaybe<ModelAttributeTypes>;
  beginsWith?: InputMaybe<Scalars['ID']['input']>;
  between?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  contains?: InputMaybe<Scalars['ID']['input']>;
  eq?: InputMaybe<Scalars['ID']['input']>;
  ge?: InputMaybe<Scalars['ID']['input']>;
  gt?: InputMaybe<Scalars['ID']['input']>;
  le?: InputMaybe<Scalars['ID']['input']>;
  lt?: InputMaybe<Scalars['ID']['input']>;
  ne?: InputMaybe<Scalars['ID']['input']>;
  notContains?: InputMaybe<Scalars['ID']['input']>;
  size?: InputMaybe<ModelSizeInput>;
};

export type ModelIntInput = {
  attributeExists?: InputMaybe<Scalars['Boolean']['input']>;
  attributeType?: InputMaybe<ModelAttributeTypes>;
  between?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  eq?: InputMaybe<Scalars['Int']['input']>;
  ge?: InputMaybe<Scalars['Int']['input']>;
  gt?: InputMaybe<Scalars['Int']['input']>;
  le?: InputMaybe<Scalars['Int']['input']>;
  lt?: InputMaybe<Scalars['Int']['input']>;
  ne?: InputMaybe<Scalars['Int']['input']>;
};

export type ModelPriceSnapshotConditionInput = {
  and?: InputMaybe<Array<InputMaybe<ModelPriceSnapshotConditionInput>>>;
  capturedAt?: InputMaybe<ModelStringInput>;
  createdAt?: InputMaybe<ModelStringInput>;
  not?: InputMaybe<ModelPriceSnapshotConditionInput>;
  or?: InputMaybe<Array<InputMaybe<ModelPriceSnapshotConditionInput>>>;
  pk?: InputMaybe<ModelStringInput>;
  priceUsd?: InputMaybe<ModelFloatInput>;
  source?: InputMaybe<ModelStringInput>;
  sourceUpdatedAt?: InputMaybe<ModelStringInput>;
  updatedAt?: InputMaybe<ModelStringInput>;
};

export type ModelPriceSnapshotConnection = {
  __typename?: 'ModelPriceSnapshotConnection';
  items: Array<Maybe<PriceSnapshot>>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type ModelPriceSnapshotFilterInput = {
  and?: InputMaybe<Array<InputMaybe<ModelPriceSnapshotFilterInput>>>;
  capturedAt?: InputMaybe<ModelStringInput>;
  createdAt?: InputMaybe<ModelStringInput>;
  id?: InputMaybe<ModelIdInput>;
  not?: InputMaybe<ModelPriceSnapshotFilterInput>;
  or?: InputMaybe<Array<InputMaybe<ModelPriceSnapshotFilterInput>>>;
  pk?: InputMaybe<ModelStringInput>;
  priceUsd?: InputMaybe<ModelFloatInput>;
  source?: InputMaybe<ModelStringInput>;
  sourceUpdatedAt?: InputMaybe<ModelStringInput>;
  updatedAt?: InputMaybe<ModelStringInput>;
};

export type ModelSizeInput = {
  between?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  eq?: InputMaybe<Scalars['Int']['input']>;
  ge?: InputMaybe<Scalars['Int']['input']>;
  gt?: InputMaybe<Scalars['Int']['input']>;
  le?: InputMaybe<Scalars['Int']['input']>;
  lt?: InputMaybe<Scalars['Int']['input']>;
  ne?: InputMaybe<Scalars['Int']['input']>;
};

export enum ModelSortDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type ModelStringInput = {
  attributeExists?: InputMaybe<Scalars['Boolean']['input']>;
  attributeType?: InputMaybe<ModelAttributeTypes>;
  beginsWith?: InputMaybe<Scalars['String']['input']>;
  between?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  contains?: InputMaybe<Scalars['String']['input']>;
  eq?: InputMaybe<Scalars['String']['input']>;
  ge?: InputMaybe<Scalars['String']['input']>;
  gt?: InputMaybe<Scalars['String']['input']>;
  le?: InputMaybe<Scalars['String']['input']>;
  lt?: InputMaybe<Scalars['String']['input']>;
  ne?: InputMaybe<Scalars['String']['input']>;
  notContains?: InputMaybe<Scalars['String']['input']>;
  size?: InputMaybe<ModelSizeInput>;
};

export type ModelStringKeyConditionInput = {
  beginsWith?: InputMaybe<Scalars['String']['input']>;
  between?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  eq?: InputMaybe<Scalars['String']['input']>;
  ge?: InputMaybe<Scalars['String']['input']>;
  gt?: InputMaybe<Scalars['String']['input']>;
  le?: InputMaybe<Scalars['String']['input']>;
  lt?: InputMaybe<Scalars['String']['input']>;
};

export type ModelSubscriptionBooleanInput = {
  eq?: InputMaybe<Scalars['Boolean']['input']>;
  ne?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ModelSubscriptionFloatInput = {
  between?: InputMaybe<Array<InputMaybe<Scalars['Float']['input']>>>;
  eq?: InputMaybe<Scalars['Float']['input']>;
  ge?: InputMaybe<Scalars['Float']['input']>;
  gt?: InputMaybe<Scalars['Float']['input']>;
  in?: InputMaybe<Array<InputMaybe<Scalars['Float']['input']>>>;
  le?: InputMaybe<Scalars['Float']['input']>;
  lt?: InputMaybe<Scalars['Float']['input']>;
  ne?: InputMaybe<Scalars['Float']['input']>;
  notIn?: InputMaybe<Array<InputMaybe<Scalars['Float']['input']>>>;
};

export type ModelSubscriptionGuessFilterInput = {
  and?: InputMaybe<Array<InputMaybe<ModelSubscriptionGuessFilterInput>>>;
  createdAt?: InputMaybe<ModelSubscriptionStringInput>;
  direction?: InputMaybe<ModelSubscriptionStringInput>;
  endPrice?: InputMaybe<ModelSubscriptionFloatInput>;
  endPriceSnapshotId?: InputMaybe<ModelSubscriptionIdInput>;
  id?: InputMaybe<ModelSubscriptionIdInput>;
  or?: InputMaybe<Array<InputMaybe<ModelSubscriptionGuessFilterInput>>>;
  outcome?: InputMaybe<ModelSubscriptionStringInput>;
  owner?: InputMaybe<ModelStringInput>;
  result?: InputMaybe<ModelSubscriptionStringInput>;
  settleAt?: InputMaybe<ModelSubscriptionStringInput>;
  startPrice?: InputMaybe<ModelSubscriptionFloatInput>;
  startPriceSnapshotId?: InputMaybe<ModelSubscriptionIdInput>;
  status?: InputMaybe<ModelSubscriptionStringInput>;
  updatedAt?: InputMaybe<ModelSubscriptionStringInput>;
};

export type ModelSubscriptionIdInput = {
  beginsWith?: InputMaybe<Scalars['ID']['input']>;
  between?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  contains?: InputMaybe<Scalars['ID']['input']>;
  eq?: InputMaybe<Scalars['ID']['input']>;
  ge?: InputMaybe<Scalars['ID']['input']>;
  gt?: InputMaybe<Scalars['ID']['input']>;
  in?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  le?: InputMaybe<Scalars['ID']['input']>;
  lt?: InputMaybe<Scalars['ID']['input']>;
  ne?: InputMaybe<Scalars['ID']['input']>;
  notContains?: InputMaybe<Scalars['ID']['input']>;
  notIn?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type ModelSubscriptionIntInput = {
  between?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  eq?: InputMaybe<Scalars['Int']['input']>;
  ge?: InputMaybe<Scalars['Int']['input']>;
  gt?: InputMaybe<Scalars['Int']['input']>;
  in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  le?: InputMaybe<Scalars['Int']['input']>;
  lt?: InputMaybe<Scalars['Int']['input']>;
  ne?: InputMaybe<Scalars['Int']['input']>;
  notIn?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export type ModelSubscriptionPriceSnapshotFilterInput = {
  and?: InputMaybe<Array<InputMaybe<ModelSubscriptionPriceSnapshotFilterInput>>>;
  capturedAt?: InputMaybe<ModelSubscriptionStringInput>;
  createdAt?: InputMaybe<ModelSubscriptionStringInput>;
  id?: InputMaybe<ModelSubscriptionIdInput>;
  or?: InputMaybe<Array<InputMaybe<ModelSubscriptionPriceSnapshotFilterInput>>>;
  pk?: InputMaybe<ModelSubscriptionStringInput>;
  priceUsd?: InputMaybe<ModelSubscriptionFloatInput>;
  source?: InputMaybe<ModelSubscriptionStringInput>;
  sourceUpdatedAt?: InputMaybe<ModelSubscriptionStringInput>;
  updatedAt?: InputMaybe<ModelSubscriptionStringInput>;
};

export type ModelSubscriptionStringInput = {
  beginsWith?: InputMaybe<Scalars['String']['input']>;
  between?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  contains?: InputMaybe<Scalars['String']['input']>;
  eq?: InputMaybe<Scalars['String']['input']>;
  ge?: InputMaybe<Scalars['String']['input']>;
  gt?: InputMaybe<Scalars['String']['input']>;
  in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  le?: InputMaybe<Scalars['String']['input']>;
  lt?: InputMaybe<Scalars['String']['input']>;
  ne?: InputMaybe<Scalars['String']['input']>;
  notContains?: InputMaybe<Scalars['String']['input']>;
  notIn?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type ModelSubscriptionUserStateFilterInput = {
  and?: InputMaybe<Array<InputMaybe<ModelSubscriptionUserStateFilterInput>>>;
  createdAt?: InputMaybe<ModelSubscriptionStringInput>;
  email?: InputMaybe<ModelSubscriptionStringInput>;
  id?: InputMaybe<ModelSubscriptionIdInput>;
  lastUpdatedAt?: InputMaybe<ModelSubscriptionStringInput>;
  or?: InputMaybe<Array<InputMaybe<ModelSubscriptionUserStateFilterInput>>>;
  owner?: InputMaybe<ModelStringInput>;
  score?: InputMaybe<ModelSubscriptionIntInput>;
  streak?: InputMaybe<ModelSubscriptionIntInput>;
  updatedAt?: InputMaybe<ModelSubscriptionStringInput>;
  username?: InputMaybe<ModelSubscriptionStringInput>;
};

export type ModelUserStateConditionInput = {
  and?: InputMaybe<Array<InputMaybe<ModelUserStateConditionInput>>>;
  createdAt?: InputMaybe<ModelStringInput>;
  email?: InputMaybe<ModelStringInput>;
  lastUpdatedAt?: InputMaybe<ModelStringInput>;
  not?: InputMaybe<ModelUserStateConditionInput>;
  or?: InputMaybe<Array<InputMaybe<ModelUserStateConditionInput>>>;
  owner?: InputMaybe<ModelStringInput>;
  score?: InputMaybe<ModelIntInput>;
  streak?: InputMaybe<ModelIntInput>;
  updatedAt?: InputMaybe<ModelStringInput>;
  username?: InputMaybe<ModelStringInput>;
};

export type ModelUserStateConnection = {
  __typename?: 'ModelUserStateConnection';
  items: Array<Maybe<UserState>>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type ModelUserStateFilterInput = {
  and?: InputMaybe<Array<InputMaybe<ModelUserStateFilterInput>>>;
  createdAt?: InputMaybe<ModelStringInput>;
  email?: InputMaybe<ModelStringInput>;
  id?: InputMaybe<ModelIdInput>;
  lastUpdatedAt?: InputMaybe<ModelStringInput>;
  not?: InputMaybe<ModelUserStateFilterInput>;
  or?: InputMaybe<Array<InputMaybe<ModelUserStateFilterInput>>>;
  owner?: InputMaybe<ModelStringInput>;
  score?: InputMaybe<ModelIntInput>;
  streak?: InputMaybe<ModelIntInput>;
  updatedAt?: InputMaybe<ModelStringInput>;
  username?: InputMaybe<ModelStringInput>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createGuess?: Maybe<Guess>;
  createPriceSnapshot?: Maybe<PriceSnapshot>;
  createUserState?: Maybe<UserState>;
  deleteGuess?: Maybe<Guess>;
  deletePriceSnapshot?: Maybe<PriceSnapshot>;
  deleteUserState?: Maybe<UserState>;
  updateGuess?: Maybe<Guess>;
  updatePriceSnapshot?: Maybe<PriceSnapshot>;
  updateUserState?: Maybe<UserState>;
};


export type MutationCreateGuessArgs = {
  condition?: InputMaybe<ModelGuessConditionInput>;
  input: CreateGuessInput;
};


export type MutationCreatePriceSnapshotArgs = {
  condition?: InputMaybe<ModelPriceSnapshotConditionInput>;
  input: CreatePriceSnapshotInput;
};


export type MutationCreateUserStateArgs = {
  condition?: InputMaybe<ModelUserStateConditionInput>;
  input: CreateUserStateInput;
};


export type MutationDeleteGuessArgs = {
  condition?: InputMaybe<ModelGuessConditionInput>;
  input: DeleteGuessInput;
};


export type MutationDeletePriceSnapshotArgs = {
  condition?: InputMaybe<ModelPriceSnapshotConditionInput>;
  input: DeletePriceSnapshotInput;
};


export type MutationDeleteUserStateArgs = {
  condition?: InputMaybe<ModelUserStateConditionInput>;
  input: DeleteUserStateInput;
};


export type MutationUpdateGuessArgs = {
  condition?: InputMaybe<ModelGuessConditionInput>;
  input: UpdateGuessInput;
};


export type MutationUpdatePriceSnapshotArgs = {
  condition?: InputMaybe<ModelPriceSnapshotConditionInput>;
  input: UpdatePriceSnapshotInput;
};


export type MutationUpdateUserStateArgs = {
  condition?: InputMaybe<ModelUserStateConditionInput>;
  input: UpdateUserStateInput;
};

export type PriceSnapshot = {
  __typename?: 'PriceSnapshot';
  capturedAt: Scalars['AWSDateTime']['output'];
  createdAt: Scalars['AWSDateTime']['output'];
  id: Scalars['ID']['output'];
  pk: Scalars['String']['output'];
  priceUsd: Scalars['Float']['output'];
  source?: Maybe<Scalars['String']['output']>;
  sourceUpdatedAt?: Maybe<Scalars['AWSDateTime']['output']>;
  updatedAt: Scalars['AWSDateTime']['output'];
};

export type Query = {
  __typename?: 'Query';
  getGuess?: Maybe<Guess>;
  getPriceSnapshot?: Maybe<PriceSnapshot>;
  getUserState?: Maybe<UserState>;
  guessesByOwner?: Maybe<ModelGuessConnection>;
  listGuesses?: Maybe<ModelGuessConnection>;
  listPriceSnapshots?: Maybe<ModelPriceSnapshotConnection>;
  listUserStates?: Maybe<ModelUserStateConnection>;
  priceSnapshotsByPk?: Maybe<ModelPriceSnapshotConnection>;
  priceSnapshotsBySourceUpdatedAt?: Maybe<ModelPriceSnapshotConnection>;
};


export type QueryGetGuessArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetPriceSnapshotArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetUserStateArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGuessesByOwnerArgs = {
  createdAt?: InputMaybe<ModelStringKeyConditionInput>;
  filter?: InputMaybe<ModelGuessFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  owner: Scalars['String']['input'];
  sortDirection?: InputMaybe<ModelSortDirection>;
};


export type QueryListGuessesArgs = {
  filter?: InputMaybe<ModelGuessFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListPriceSnapshotsArgs = {
  filter?: InputMaybe<ModelPriceSnapshotFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListUserStatesArgs = {
  filter?: InputMaybe<ModelUserStateFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryPriceSnapshotsByPkArgs = {
  capturedAt?: InputMaybe<ModelStringKeyConditionInput>;
  filter?: InputMaybe<ModelPriceSnapshotFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  pk: Scalars['String']['input'];
  sortDirection?: InputMaybe<ModelSortDirection>;
};


export type QueryPriceSnapshotsBySourceUpdatedAtArgs = {
  filter?: InputMaybe<ModelPriceSnapshotFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  pk: Scalars['String']['input'];
  sortDirection?: InputMaybe<ModelSortDirection>;
  sourceUpdatedAt?: InputMaybe<ModelStringKeyConditionInput>;
};

export type Subscription = {
  __typename?: 'Subscription';
  onCreateGuess?: Maybe<Guess>;
  onCreatePriceSnapshot?: Maybe<PriceSnapshot>;
  onCreateUserState?: Maybe<UserState>;
  onDeleteGuess?: Maybe<Guess>;
  onDeletePriceSnapshot?: Maybe<PriceSnapshot>;
  onDeleteUserState?: Maybe<UserState>;
  onUpdateGuess?: Maybe<Guess>;
  onUpdatePriceSnapshot?: Maybe<PriceSnapshot>;
  onUpdateUserState?: Maybe<UserState>;
};


export type SubscriptionOnCreateGuessArgs = {
  filter?: InputMaybe<ModelSubscriptionGuessFilterInput>;
  owner?: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionOnCreatePriceSnapshotArgs = {
  filter?: InputMaybe<ModelSubscriptionPriceSnapshotFilterInput>;
};


export type SubscriptionOnCreateUserStateArgs = {
  filter?: InputMaybe<ModelSubscriptionUserStateFilterInput>;
  owner?: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionOnDeleteGuessArgs = {
  filter?: InputMaybe<ModelSubscriptionGuessFilterInput>;
  owner?: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionOnDeletePriceSnapshotArgs = {
  filter?: InputMaybe<ModelSubscriptionPriceSnapshotFilterInput>;
};


export type SubscriptionOnDeleteUserStateArgs = {
  filter?: InputMaybe<ModelSubscriptionUserStateFilterInput>;
  owner?: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionOnUpdateGuessArgs = {
  filter?: InputMaybe<ModelSubscriptionGuessFilterInput>;
  owner?: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionOnUpdatePriceSnapshotArgs = {
  filter?: InputMaybe<ModelSubscriptionPriceSnapshotFilterInput>;
};


export type SubscriptionOnUpdateUserStateArgs = {
  filter?: InputMaybe<ModelSubscriptionUserStateFilterInput>;
  owner?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateGuessInput = {
  createdAt?: InputMaybe<Scalars['AWSDateTime']['input']>;
  direction?: InputMaybe<GuessDirection>;
  endPrice?: InputMaybe<Scalars['Float']['input']>;
  endPriceSnapshotId?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  outcome?: InputMaybe<GuessOutcome>;
  owner?: InputMaybe<Scalars['String']['input']>;
  result?: InputMaybe<GuessDirection>;
  settleAt?: InputMaybe<Scalars['AWSDateTime']['input']>;
  startPrice?: InputMaybe<Scalars['Float']['input']>;
  startPriceSnapshotId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<GuessStatus>;
};

export type UpdatePriceSnapshotInput = {
  capturedAt?: InputMaybe<Scalars['AWSDateTime']['input']>;
  id: Scalars['ID']['input'];
  pk?: InputMaybe<Scalars['String']['input']>;
  priceUsd?: InputMaybe<Scalars['Float']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  sourceUpdatedAt?: InputMaybe<Scalars['AWSDateTime']['input']>;
};

export type UpdateUserStateInput = {
  email?: InputMaybe<Scalars['AWSEmail']['input']>;
  id: Scalars['ID']['input'];
  lastUpdatedAt?: InputMaybe<Scalars['AWSDateTime']['input']>;
  owner?: InputMaybe<Scalars['String']['input']>;
  score?: InputMaybe<Scalars['Int']['input']>;
  streak?: InputMaybe<Scalars['Int']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
};

export type UserState = {
  __typename?: 'UserState';
  createdAt: Scalars['AWSDateTime']['output'];
  email: Scalars['AWSEmail']['output'];
  id: Scalars['ID']['output'];
  lastUpdatedAt: Scalars['AWSDateTime']['output'];
  owner: Scalars['String']['output'];
  score: Scalars['Int']['output'];
  streak: Scalars['Int']['output'];
  updatedAt: Scalars['AWSDateTime']['output'];
  username: Scalars['String']['output'];
};

export type PriceSnapshotsByPkQueryVariables = Exact<{
  pk: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  sortDirection?: InputMaybe<ModelSortDirection>;
}>;


export type PriceSnapshotsByPkQuery = { __typename?: 'Query', priceSnapshotsByPk?: { __typename?: 'ModelPriceSnapshotConnection', items: Array<{ __typename?: 'PriceSnapshot', id: string, pk: string, capturedAt: string, priceUsd: number, sourceUpdatedAt?: string | null } | null> } | null };

export type OnCreatePriceSnapshotSubscriptionVariables = Exact<{
  filter?: InputMaybe<ModelSubscriptionPriceSnapshotFilterInput>;
}>;


export type OnCreatePriceSnapshotSubscription = { __typename?: 'Subscription', onCreatePriceSnapshot?: { __typename?: 'PriceSnapshot', id: string, pk: string, capturedAt: string, priceUsd: number, sourceUpdatedAt?: string | null } | null };

export type GetUserStateQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetUserStateQuery = { __typename?: 'Query', getUserState?: { __typename?: 'UserState', id: string, score: number, username: string, email: string } | null };


export const PriceSnapshotsByPkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PriceSnapshotsByPk"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pk"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sortDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ModelSortDirection"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"priceSnapshotsByPk"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pk"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"sortDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sortDirection"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"pk"}},{"kind":"Field","name":{"kind":"Name","value":"capturedAt"}},{"kind":"Field","name":{"kind":"Name","value":"priceUsd"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUpdatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<PriceSnapshotsByPkQuery, PriceSnapshotsByPkQueryVariables>;
export const OnCreatePriceSnapshotDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"OnCreatePriceSnapshot"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ModelSubscriptionPriceSnapshotFilterInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onCreatePriceSnapshot"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"pk"}},{"kind":"Field","name":{"kind":"Name","value":"capturedAt"}},{"kind":"Field","name":{"kind":"Name","value":"priceUsd"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUpdatedAt"}}]}}]}}]} as unknown as DocumentNode<OnCreatePriceSnapshotSubscription, OnCreatePriceSnapshotSubscriptionVariables>;
export const GetUserStateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserState"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getUserState"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}}]}}]} as unknown as DocumentNode<GetUserStateQuery, GetUserStateQueryVariables>;