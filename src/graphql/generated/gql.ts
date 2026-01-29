/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "subscription OnUpdateGuess($owner: String) {\n  onUpdateGuess(owner: $owner) {\n    id\n    owner\n    createdAt\n    settleAt\n    direction\n    status\n    startPrice\n    endPrice\n    result\n    outcome\n    updatedAt\n  }\n}": typeof types.OnUpdateGuessDocument,
    "query PriceSnapshotsByPk($pk: String!, $limit: Int, $sortDirection: ModelSortDirection) {\n  priceSnapshotsByPk(pk: $pk, limit: $limit, sortDirection: $sortDirection) {\n    items {\n      id\n      pk\n      capturedAt\n      priceUsd\n      sourceUpdatedAt\n    }\n  }\n}": typeof types.PriceSnapshotsByPkDocument,
    "subscription OnCreatePriceSnapshot($filter: ModelSubscriptionPriceSnapshotFilterInput) {\n  onCreatePriceSnapshot(filter: $filter) {\n    id\n    pk\n    capturedAt\n    priceUsd\n    sourceUpdatedAt\n  }\n}": typeof types.OnCreatePriceSnapshotDocument,
    "mutation CreateGuess($input: CreateGuessInput!) {\n  createGuess(input: $input) {\n    id\n    owner\n    createdAt\n    settleAt\n    direction\n    status\n    startPrice\n    endPrice\n    result\n    outcome\n  }\n}\n\nquery GuessesByOwner($owner: String!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String, $filter: ModelGuessFilterInput) {\n  guessesByOwner(\n    owner: $owner\n    sortDirection: $sortDirection\n    limit: $limit\n    nextToken: $nextToken\n    filter: $filter\n  ) {\n    items {\n      id\n      owner\n      createdAt\n      settleAt\n      direction\n      status\n      startPrice\n      endPrice\n      result\n      outcome\n      updatedAt\n    }\n    nextToken\n  }\n}": typeof types.CreateGuessDocument,
    "query GetUserState($id: ID!) {\n  getUserState(id: $id) {\n    id\n    score\n    username\n    email\n  }\n}": typeof types.GetUserStateDocument,
};
const documents: Documents = {
    "subscription OnUpdateGuess($owner: String) {\n  onUpdateGuess(owner: $owner) {\n    id\n    owner\n    createdAt\n    settleAt\n    direction\n    status\n    startPrice\n    endPrice\n    result\n    outcome\n    updatedAt\n  }\n}": types.OnUpdateGuessDocument,
    "query PriceSnapshotsByPk($pk: String!, $limit: Int, $sortDirection: ModelSortDirection) {\n  priceSnapshotsByPk(pk: $pk, limit: $limit, sortDirection: $sortDirection) {\n    items {\n      id\n      pk\n      capturedAt\n      priceUsd\n      sourceUpdatedAt\n    }\n  }\n}": types.PriceSnapshotsByPkDocument,
    "subscription OnCreatePriceSnapshot($filter: ModelSubscriptionPriceSnapshotFilterInput) {\n  onCreatePriceSnapshot(filter: $filter) {\n    id\n    pk\n    capturedAt\n    priceUsd\n    sourceUpdatedAt\n  }\n}": types.OnCreatePriceSnapshotDocument,
    "mutation CreateGuess($input: CreateGuessInput!) {\n  createGuess(input: $input) {\n    id\n    owner\n    createdAt\n    settleAt\n    direction\n    status\n    startPrice\n    endPrice\n    result\n    outcome\n  }\n}\n\nquery GuessesByOwner($owner: String!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String, $filter: ModelGuessFilterInput) {\n  guessesByOwner(\n    owner: $owner\n    sortDirection: $sortDirection\n    limit: $limit\n    nextToken: $nextToken\n    filter: $filter\n  ) {\n    items {\n      id\n      owner\n      createdAt\n      settleAt\n      direction\n      status\n      startPrice\n      endPrice\n      result\n      outcome\n      updatedAt\n    }\n    nextToken\n  }\n}": types.CreateGuessDocument,
    "query GetUserState($id: ID!) {\n  getUserState(id: $id) {\n    id\n    score\n    username\n    email\n  }\n}": types.GetUserStateDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "subscription OnUpdateGuess($owner: String) {\n  onUpdateGuess(owner: $owner) {\n    id\n    owner\n    createdAt\n    settleAt\n    direction\n    status\n    startPrice\n    endPrice\n    result\n    outcome\n    updatedAt\n  }\n}"): (typeof documents)["subscription OnUpdateGuess($owner: String) {\n  onUpdateGuess(owner: $owner) {\n    id\n    owner\n    createdAt\n    settleAt\n    direction\n    status\n    startPrice\n    endPrice\n    result\n    outcome\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query PriceSnapshotsByPk($pk: String!, $limit: Int, $sortDirection: ModelSortDirection) {\n  priceSnapshotsByPk(pk: $pk, limit: $limit, sortDirection: $sortDirection) {\n    items {\n      id\n      pk\n      capturedAt\n      priceUsd\n      sourceUpdatedAt\n    }\n  }\n}"): (typeof documents)["query PriceSnapshotsByPk($pk: String!, $limit: Int, $sortDirection: ModelSortDirection) {\n  priceSnapshotsByPk(pk: $pk, limit: $limit, sortDirection: $sortDirection) {\n    items {\n      id\n      pk\n      capturedAt\n      priceUsd\n      sourceUpdatedAt\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "subscription OnCreatePriceSnapshot($filter: ModelSubscriptionPriceSnapshotFilterInput) {\n  onCreatePriceSnapshot(filter: $filter) {\n    id\n    pk\n    capturedAt\n    priceUsd\n    sourceUpdatedAt\n  }\n}"): (typeof documents)["subscription OnCreatePriceSnapshot($filter: ModelSubscriptionPriceSnapshotFilterInput) {\n  onCreatePriceSnapshot(filter: $filter) {\n    id\n    pk\n    capturedAt\n    priceUsd\n    sourceUpdatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation CreateGuess($input: CreateGuessInput!) {\n  createGuess(input: $input) {\n    id\n    owner\n    createdAt\n    settleAt\n    direction\n    status\n    startPrice\n    endPrice\n    result\n    outcome\n  }\n}\n\nquery GuessesByOwner($owner: String!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String, $filter: ModelGuessFilterInput) {\n  guessesByOwner(\n    owner: $owner\n    sortDirection: $sortDirection\n    limit: $limit\n    nextToken: $nextToken\n    filter: $filter\n  ) {\n    items {\n      id\n      owner\n      createdAt\n      settleAt\n      direction\n      status\n      startPrice\n      endPrice\n      result\n      outcome\n      updatedAt\n    }\n    nextToken\n  }\n}"): (typeof documents)["mutation CreateGuess($input: CreateGuessInput!) {\n  createGuess(input: $input) {\n    id\n    owner\n    createdAt\n    settleAt\n    direction\n    status\n    startPrice\n    endPrice\n    result\n    outcome\n  }\n}\n\nquery GuessesByOwner($owner: String!, $sortDirection: ModelSortDirection, $limit: Int, $nextToken: String, $filter: ModelGuessFilterInput) {\n  guessesByOwner(\n    owner: $owner\n    sortDirection: $sortDirection\n    limit: $limit\n    nextToken: $nextToken\n    filter: $filter\n  ) {\n    items {\n      id\n      owner\n      createdAt\n      settleAt\n      direction\n      status\n      startPrice\n      endPrice\n      result\n      outcome\n      updatedAt\n    }\n    nextToken\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetUserState($id: ID!) {\n  getUserState(id: $id) {\n    id\n    score\n    username\n    email\n  }\n}"): (typeof documents)["query GetUserState($id: ID!) {\n  getUserState(id: $id) {\n    id\n    score\n    username\n    email\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;