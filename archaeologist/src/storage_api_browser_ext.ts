/**
 * An implementation of @see smuggler-api.StorageApi that persists the data
 * in a storage only available to browser extensions (most likely - locally on device).
 *
 * It is intended to work in all browser extension contexts (such as background,
 * content etc).
 * See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage
 * for more information.
 *
 * NOTE: At the time of this writing dev tools of some browsers (including the
 * Chromium-based ones) do not include anything that would allow to inspect the contents
 * of the underlying storage. See https://stackoverflow.com/a/27432365/3375765
 * for workarounds.
 */

import type {
  AccountInfo,
  Ack,
  AccountInfoGetArgs,
  AccountInfoSetArgs,
  ActivityAssociationGetArgs,
  ActivityAssociationRecordArgs,
  ActivityExternalAddArgs,
  ActivityExternalGetArgs,
  EdgeCreateArgs,
  EdgeGetArgs,
  Eid,
  ExternalAssociationEnd,
  ExternalIngestionAdvanceArgs,
  ExternalIngestionGetArgs,
  GetUserExternalAssociationsResponse,
  NewNodeResponse,
  Nid,
  NodeBatch,
  NodeBatchRequestBody,
  NodeBulkDeleteArgs,
  NodeCreateArgs,
  NodeCreatedVia,
  NodeDeleteArgs,
  NodeEdges,
  NodeGetAllNidsArgs,
  NodeGetArgs,
  NodeGetByOriginArgs,
  NodeSimilaritySearchInfo,
  NodeUpdateArgs,
  OriginHash,
  OriginId,
  ResourceAttention,
  ResourceVisit,
  SetNodeSimilaritySearchInfoArgs,
  StorageApi,
  TEdge,
  TEdgeJson,
  TNode,
  TNodeJson,
  TotalUserActivity,
  UserExternalAssociationType,
  UserExternalPipelineId,
  UserExternalPipelineIngestionProgress,
} from 'smuggler-api'
import {
  INodeIterator,
  NodeUtil,
  EdgeUtil,
  NodeType,
  NodeEvent,
} from 'smuggler-api'
import { v4 as uuidv4 } from 'uuid'

import browser from 'webextension-polyfill'
import { MimeType, log, unixtime } from 'armoury'
import lodash from 'lodash'

// TODO[snikitin@outlook.com] Describe that "yek" is "key" in reverse,
// used to distinguish typesafe keys from just pure string keys used in
// browser.Storage.StorageArea
type GenericYek<Kind extends string, Key> = {
  yek: {
    kind: Kind
    key: Key
  }
}
// TODO[snikitin@outlook.com] Describe that "lav" is "val" (short for "value")
// in reverse, used to distinguish typesafe keys from just "any" JSON value used
// in browser.Storage.StorageArea
type GenericLav<Kind extends string, Value, Auxiliary = undefined> = {
  lav: {
    kind: Kind
    value: Value
    /**
     * Additional data which due to various reasons (such as historical)
     * are not part of the core @see Value structure, but storing it alongside
     * is helpful for implementation of @see StorageApi.
     * As an alternative to a separate 'auxiliary' field, @see Value could
     * be augmented with extra fields itself, but that is avoided deliberately
     * to reduce chances of this "service" data leaking outside the StorageApi
     * implementation.
     */
    auxiliary?: Auxiliary
  }
}

/**
 * Structure describes a node in minimalistic maner to build a full list of all
 * nodes out of it. All node fields mentioned here are immutable throughout of
 * a node life.
 */
type NodeTag = {
  // A unique node identifier, there is no more than one item in the list with
  // the same nid.
  nid: Nid

  // The rest of the fields are added here for quick sorting purposes.

  // Node creation date, exact copy of the `created_at` fild of the `TNode`.
  created_at: unixtime.Type
}
type AllNidsYek = GenericYek<'all-nids', undefined>
type AllNidsLav = GenericLav<'all-nids', NodeTag[]>

type NidToNodeYek = GenericYek<'nid->node', Nid>
type NidToNodeLav = GenericLav<
  'nid->node',
  TNodeJson,
  { origin?: OriginId; created_via?: NodeCreatedVia }
>

type OriginToNidYek = GenericYek<'origin->nid', OriginId>
type OriginToNidLav = GenericLav<'origin->nid', { nid: Nid }[]>

type NidToEdgeYek = GenericYek<'nid->edge', Nid>
type NidToEdgeLav = GenericLav<'nid->edge', TEdgeJson[]>

type OriginToActivityYek = GenericYek<'origin->activity', OriginId>
type OriginToActivityLav = GenericLav<
  'origin->activity',
  {
    visits: (ResourceVisit & { reported_by?: UserExternalPipelineId })[]
    attentions: ResourceAttention[]
    total_seconds_of_attention: number
  }
>

type ExtPipelineYek = GenericYek<
  'ext-pipe-id->progress',
  UserExternalPipelineId
>
type ExtPipelineLav = GenericLav<
  'ext-pipe-id->progress',
  Omit<UserExternalPipelineIngestionProgress, 'epid'>
>

type ExtPipelineToNidYek = GenericYek<
  'ext-pipe-id->nid',
  UserExternalPipelineId
>
type ExtPipelineToNidLav = GenericLav<'ext-pipe-id->nid', { nid: Nid }[]>

type OriginToExtAssociationYek = GenericYek<'origin->ext-assoc', OriginId>
type OriginToExtAssociationValue = {
  /**
   * `direction`'s meaning may be unintuitive when it comes to writing/reading code.
   * Instead, at the time of this writing the intent was to optimise for
   * a different purpose - debugging of 'browser.storage.local' data when it
   * gets dumped to log/console.
   *
   * 'origin->ext-assoc' yek/lav pair looks somewhat like
   *    {yek:*origin-id-1*}/{lav:          *direction*, *origin-id-2*}
   * which is expected to be read by a developer as:
   *    "    *origin-id-1* has association *from / to*  *origin-id-2*"
   */
  direction: 'from' | 'to'
  other: OriginId
  association: UserExternalAssociationType
}
type OriginToExtAssociationLav = GenericLav<
  'origin->ext-assoc',
  OriginToExtAssociationValue[]
>

type NidToNodeSimilaritySearchInfoYek = GenericYek<'nid->sim-search-node', Nid>
type NidToNodeSimilaritySearchInfoLav = GenericLav<
  'nid->sim-search-node',
  NodeSimilaritySearchInfo
>

type UserAccountInfoYek = GenericYek<'account-info', undefined>
type UserAccountInfoLav = GenericLav<'account-info', AccountInfo>

type Yek =
  | AllNidsYek
  | NidToNodeYek
  | OriginToNidYek
  | NidToEdgeYek
  | OriginToActivityYek
  | ExtPipelineYek
  | ExtPipelineToNidYek
  | OriginToExtAssociationYek
  | NidToNodeSimilaritySearchInfoYek
  | UserAccountInfoYek

type Lav =
  | AllNidsLav
  | NidToNodeLav
  | OriginToNidLav
  | NidToEdgeLav
  | OriginToActivityLav
  | ExtPipelineLav
  | ExtPipelineToNidLav
  | OriginToExtAssociationLav
  | NidToNodeSimilaritySearchInfoLav
  | UserAccountInfoLav

type YekLav = { yek: Yek; lav: Lav }

function isOfArrayKind(
  lav: Lav
): lav is
  | OriginToNidLav
  | NidToEdgeLav
  | AllNidsLav
  | ExtPipelineToNidLav
  | OriginToExtAssociationLav {
  return Array.isArray(lav.lav.value)
}

// TODO[snikitin@outlook.com] Describe that the purpose of this wrapper is to
// add a bit of ORM-like typesafety to browser.Storage.StorageArea.
// Without this it's very difficult to keep track of what the code is doing
// and what it's supposed to do
class YekLavStore {
  private store: browser.Storage.StorageArea

  constructor(store: browser.Storage.StorageArea) {
    this.store = store
  }

  // TODO[snikitin@outlook.com] Add a note that the code that uses this
  // method should try to combine everything it needs to do into ONE
  // call to set() in hopes to retain at least some data consistency
  // guarantees.
  set(items: YekLav[]): Promise<void> {
    for (const item of items) {
      if (item.yek.yek.kind !== item.lav.lav.kind) {
        throw new Error(
          `Attempted to set a key/value pair of mismatching kinds: '${item.yek.yek.kind}' !== '${item.lav.lav.kind}'`
        )
      }
    }
    let records: Record<string, any> = {}
    for (const item of items) {
      const key = this.stringify(item.yek)
      if (Object.keys(records).indexOf(key) !== -1) {
        throw new Error(`Attempted to set more than 1 value for key '${key}'`)
      }
      records[key] = item.lav
    }
    return this.store.set(records)
  }

  get(yek: AllNidsYek): Promise<AllNidsLav | undefined>
  get(yek: NidToNodeYek): Promise<NidToNodeLav | undefined>
  get(yek: OriginToNidYek): Promise<OriginToNidLav | undefined>
  get(
    yek: OriginToNidYek[]
  ): Promise<{ yek: OriginToNidYek; lav: OriginToNidLav }[]>
  get(yek: NidToEdgeYek): Promise<NidToEdgeLav | undefined>
  get(yek: NidToNodeYek[]): Promise<{ yek: NidToNodeYek; lav: NidToNodeLav }[]>
  get(yek: OriginToActivityYek): Promise<OriginToActivityLav | undefined>
  get(yek: ExtPipelineYek): Promise<ExtPipelineLav | undefined>
  get(yek: ExtPipelineToNidYek): Promise<ExtPipelineToNidLav | undefined>
  get(
    yek: OriginToExtAssociationYek
  ): Promise<OriginToExtAssociationLav | undefined>
  get(
    yek: NidToNodeSimilaritySearchInfoYek
  ): Promise<NidToNodeSimilaritySearchInfoLav | undefined>
  get(yek: UserAccountInfoYek): Promise<UserAccountInfoLav | undefined>
  get(yek: Yek): Promise<Lav | undefined>
  get(yek: Yek | Yek[]): Promise<Lav | YekLav[] | undefined> {
    if (Array.isArray(yek)) {
      const keyToYek = new Map<string, Yek>()
      yek.forEach((singleYek: Yek) =>
        keyToYek.set(this.stringify(singleYek), singleYek)
      )
      const keys: string[] = Array.from(keyToYek.keys())
      const records: Promise<Record<string, any>> = this.store.get(keys)
      return records.then((records: Record<string, any>): Promise<YekLav[]> => {
        const yeklavs: YekLav[] = []
        for (const [key, yek] of keyToYek) {
          const lav = key in records ? (records[key] as Lav) : undefined
          if (lav == null) {
            continue
          }
          yeklavs.push({ yek, lav })
        }
        return Promise.resolve(yeklavs)
      })
    }

    const key = this.stringify(yek)
    const records: Promise<Record<string, any>> = this.store.get(key)
    return records.then(
      (records: Record<string, any>): Promise<Lav | undefined> => {
        const record = records[key]
        if (record == null) {
          return Promise.resolve(undefined)
        }
        return Promise.resolve(record as Lav)
      }
    )
  }

  // TODO[snikitin@outlook.com] Explain that this method is a poor man's attempt
  // to increase atomicity of data insertion
  async prepareAppend(
    yek: AllNidsYek,
    lav: AllNidsLav
  ): Promise<{
    yek: AllNidsYek
    lav: AllNidsLav
  }>
  async prepareAppend(
    yek: OriginToNidYek,
    lav: OriginToNidLav
  ): Promise<{
    yek: OriginToNidYek
    lav: OriginToNidLav
  }>
  async prepareAppend(
    yek: NidToEdgeYek,
    lav: NidToEdgeLav
  ): Promise<{
    yek: NidToEdgeYek
    lav: NidToEdgeLav
  }>
  async prepareAppend(
    yek: ExtPipelineToNidYek,
    lav: ExtPipelineToNidLav
  ): Promise<{
    yek: ExtPipelineToNidYek
    lav: ExtPipelineToNidLav
  }>
  async prepareAppend(yek: Yek, appended_lav: Lav): Promise<YekLav> {
    if (yek.yek.kind !== appended_lav.lav.kind) {
      throw new Error(
        `Attempted to append a key/value pair of mismatching kinds: '${yek.yek.kind}' !== '${appended_lav.lav.kind}'`
      )
    }
    const lav = await this.get(yek)
    if (lav != null && !isOfArrayKind(lav)) {
      throw new Error(`prepareAppend only works/makes sense for arrays`)
    }
    const value = lav?.lav.value ?? []
    // TODO[snikitin@outlook.com] I'm sure it's possible to convince Typescript
    // that below is safe, but don't know how
    return {
      yek,
      // @ts-ignore Type '{...}' is not assignable to type 'Lav'
      lav: {
        lav: {
          kind: yek.yek.kind,
          // @ts-ignore Each member of the union type has signatures, but none of those
          // signatures are compatible with each other
          value: value.concat(appended_lav.lav.value),
        },
      },
    }
  }

  async remove(yeks: Yek[]): Promise<void> {
    return this.store.remove(yeks.map(this.stringify))
  }

  async prepareRemoval(
    yek: AllNidsYek,
    criteria: Nid[]
  ): Promise<{
    yek: AllNidsYek
    lav: AllNidsLav
  }>
  async prepareRemoval(
    yek: OriginToNidYek,
    criteria: Nid[]
  ): Promise<{
    yek: OriginToNidYek
    lav: OriginToNidLav
  }>
  async prepareRemoval(
    yek: NidToEdgeYek,
    criteria: Nid[]
  ): Promise<{
    yek: OriginToNidYek
    lav: OriginToNidLav
  }>
  /**
   *
   * @param yek A yek that points to a lav from which the data should be removed
   * @param criteria Criteria (similar to a predicate) of which values should
   * be removed from a lav assosiated with the input yek
   */
  async prepareRemoval(yek: Yek, criteria: Nid[]): Promise<YekLav> {
    const lav = await this.get(yek)
    if (lav != null && !isOfArrayKind(lav)) {
      throw new Error(`prepareRemoval only works/makes sense for arrays`)
    }
    const isArrayOfObjectsWithNidField = (
      kind: typeof yek.yek.kind,
      _criteria: object[]
    ): _criteria is { nid: Nid }[] => {
      return kind === 'all-nids' || kind === 'origin->nid'
    }
    const isTEdgeJsonArray = (
      kind: typeof yek.yek.kind,
      _criteria: any[]
    ): _criteria is TEdgeJson[] => {
      return kind === 'nid->edge'
    }

    const value = lav?.lav.value ?? []
    switch (yek.yek.kind) {
      case 'all-nids':
      case 'origin->nid': {
        if (!isArrayOfObjectsWithNidField(yek.yek.kind, value)) {
          throw new Error(
            'Fallen into prepareRemoval case which works only for arrays of ' +
              `Nids while processing a non-Nid '${yek.yek.kind}' kind`
          )
        }
        lodash.remove(
          value,
          ({ nid }: { nid: Nid }) => criteria.indexOf(nid) !== -1
        )
        break
      }
      case 'nid->edge': {
        if (!isTEdgeJsonArray(yek.yek.kind, value)) {
          throw new Error(
            'Fallen into prepareRemoval case which works only for arrays of ' +
              `TEdgeJson while processing a non-edge '${yek.yek.kind}' kind`
          )
        }
        lodash.remove(
          value,
          (edge: TEdgeJson) =>
            criteria.indexOf(edge.from_nid) !== -1 ||
            criteria.indexOf(edge.to_nid) !== -1
        )
        break
      }
    }
    return {
      yek,
      lav: {
        // @ts-ignore Types of property 'kind' are incompatible
        lav: {
          kind: yek.yek.kind,
          value,
        },
      },
    }
  }

  private stringify(yek: Yek): string {
    switch (yek.yek.kind) {
      case 'all-nids':
        return 'all-nids'
      case 'nid->node':
        return 'nid->node:' + yek.yek.key
      case 'origin->nid':
        return 'origin->nid:' + yek.yek.key.id
      case 'nid->edge':
        return 'nid->edge:' + yek.yek.key
      case 'origin->activity':
        return 'origin->activity:' + yek.yek.key.id
      case 'ext-pipe-id->progress':
        return 'ext-pipe:' + yek.yek.key.pipeline_key
      case 'ext-pipe-id->nid':
        return 'ext-pipe-id->nid:' + yek.yek.key.pipeline_key
      case 'origin->ext-assoc':
        return 'origin->ext-assoc:' + yek.yek.key.id
      case 'nid->sim-search-node':
        return 'nid->sim-search-node:' + yek.yek.key
      case 'account-info':
        return 'account-info'
    }
  }
}

function generateNid(): Nid {
  /**
   * Generate UUID v4 and repack it from HEX to base36, rejoining back without
   * '-' separator. All of this to reduce the length of the end result string,
   * to reduce size of similarity search indexes.
   * Before: `cgtp8s9h64wpabb1chh30b9m6wwp2bb175h30b9m6rw3ae9qcdk3ecb46r`
   * Now:    `h294fu4gocpuy7y1twv41aawh`
   */
  return uuidv4()
    .split('-')
    .map((hexString: string) => parseInt(hexString, 16).toString(36))
    .join('')
}

function generateEid(): Eid {
  /**
   * The implementation tries to produce a @see Eid that's structurally similar
   * to the output of smuggler's EdgeId::gen(). No attempts are made to mimic
   * its behaviour however.
   */
  return generateNid()
}

async function createNode(
  store: YekLavStore,
  args: NodeCreateArgs
): Promise<NewNodeResponse> {
  const from_nid: Nid[] = args.from_nid ?? []
  const to_nid: Nid[] = args.to_nid ?? []
  const createdAt = args.created_at ?? unixtime.now()
  const node: TNodeJson = {
    nid: generateNid(),
    ntype: args.ntype ?? NodeType.Text,
    text: args.text,
    extattrs: args.extattrs,
    index_text: args.index_text,
    created_at: createdAt,
    updated_at: createdAt,
  }

  let records: YekLav[] = [
    await store.prepareAppend(
      { yek: { kind: 'all-nids', key: undefined } },
      {
        lav: {
          kind: 'all-nids',
          value: [{ nid: node.nid, created_at: node.created_at }],
        },
      }
    ),
    {
      yek: { yek: { kind: 'nid->node', key: node.nid } },
      lav: {
        lav: {
          kind: 'nid->node',
          value: node,
          auxiliary: { origin: args.origin, created_via: args.created_via },
        },
      },
    },
  ]

  if (args.origin != null) {
    const yek: OriginToNidYek = {
      yek: { kind: 'origin->nid', key: args.origin },
    }
    const lav: OriginToNidLav = {
      lav: { kind: 'origin->nid', value: [{ nid: node.nid }] },
    }
    records.push(await store.prepareAppend(yek, lav))
  }

  if (args.created_via != null) {
    if ('autoIngestion' in args.created_via) {
      const epid = args.created_via.autoIngestion
      const yek: ExtPipelineToNidYek = {
        yek: { kind: 'ext-pipe-id->nid', key: epid },
      }
      const lav: ExtPipelineToNidLav = {
        lav: { kind: 'ext-pipe-id->nid', value: [{ nid: node.nid }] },
      }
      records.push(await store.prepareAppend(yek, lav))
    }
  }

  if (from_nid.length > 0 || to_nid.length > 0) {
    const common: Pick<TEdgeJson, 'crtd' | 'upd' | 'is_sticky' | 'owned_by'> = {
      crtd: createdAt,
      upd: createdAt,
      is_sticky: false,
    }
    // Step 1: create records that allow to discover connected nodes from the
    // newly created node
    const from_edges: TEdgeJson[] = from_nid.map((from_nid: Nid): TEdgeJson => {
      return { eid: generateEid(), from_nid, to_nid: node.nid, ...common }
    })
    const to_edges: TEdgeJson[] = to_nid.map((to_nid: Nid): TEdgeJson => {
      return { eid: generateEid(), from_nid: node.nid, to_nid, ...common }
    })
    {
      const yek: NidToEdgeYek = { yek: { kind: 'nid->edge', key: node.nid } }
      let lav: NidToEdgeLav = {
        lav: { kind: 'nid->edge', value: lodash.concat(from_edges, to_edges) },
      }
      records.push({ yek, lav })
    }

    // Step 2: create records that allow to discover the newly created node
    // from the other connected nodes
    for (const edge of from_edges) {
      const yek: NidToEdgeYek = {
        yek: { kind: 'nid->edge', key: edge.from_nid },
      }
      let lav: NidToEdgeLav = {
        lav: { kind: 'nid->edge', value: [edge] },
      }
      records.push(await store.prepareAppend(yek, lav))
    }
    for (const edge of to_edges) {
      const yek: NidToEdgeYek = {
        yek: { kind: 'nid->edge', key: edge.to_nid },
      }
      let lav: NidToEdgeLav = {
        lav: { kind: 'nid->edge', value: [edge] },
      }
      records.push(await store.prepareAppend(yek, lav))
    }
  }

  await store.set(records)
  NodeEvent.registerEvent('created', node.nid, {
    text: node.text,
    index_text: node.index_text,
    extattrs: node.extattrs,
    ntype: node.ntype,
  })
  return { nid: node.nid }
}

async function getNode(
  store: YekLavStore,
  { nid }: NodeGetArgs
): Promise<TNode> {
  const yek: NidToNodeYek = { yek: { kind: 'nid->node', key: nid } }
  const lav: NidToNodeLav | undefined = await store.get(yek)
  if (lav == null) {
    throw new Error(`Failed to get node ${nid} because it wasn't found`)
  }
  const value: TNodeJson = lav.lav.value
  return NodeUtil.fromJson(value)
}

async function getNodesByOrigin(
  store: YekLavStore,
  { origin }: NodeGetByOriginArgs
): Promise<TNode[]> {
  const yek: OriginToNidYek = { yek: { kind: 'origin->nid', key: origin } }
  const lav: OriginToNidLav | undefined = await store.get(yek)
  if (lav == null) {
    return []
  }
  const value = lav.lav.value
  const nidYeks: NidToNodeYek[] = value.map(
    ({ nid }: { nid: Nid }): NidToNodeYek => {
      return { yek: { kind: 'nid->node', key: nid } }
    }
  )
  const nidLavs: NidToNodeLav[] = (await store.get(nidYeks)).map(
    (yeklav) => yeklav.lav
  )
  return nidLavs.map((lav: NidToNodeLav) => NodeUtil.fromJson(lav.lav.value))
}

async function getNodeBatch(
  store: YekLavStore,
  args: NodeBatchRequestBody
): Promise<NodeBatch> {
  const yeks: NidToNodeYek[] = args.nids.map((nid: Nid): NidToNodeYek => {
    return { yek: { kind: 'nid->node', key: nid } }
  })
  const lavs: NidToNodeLav[] = (await store.get(yeks)).map(
    (yeklav) => yeklav.lav
  )
  return {
    nodes: lavs.map((lav: NidToNodeLav) => NodeUtil.fromJson(lav.lav.value)),
  }
}

async function updateNode(
  store: YekLavStore,
  args: NodeUpdateArgs
): Promise<Ack> {
  const yek: NidToNodeYek = { yek: { kind: 'nid->node', key: args.nid } }
  const lav: NidToNodeLav | undefined = await store.get(yek)
  if (lav == null) {
    throw new Error(`Failed to update node ${args.nid} because it wasn't found`)
  }
  const value: TNodeJson = lav.lav.value
  value.text = args.text != null ? args.text : value.text
  value.index_text =
    args.index_text != null ? args.index_text : value.index_text
  if (!args.preserve_update_time) {
    value.updated_at = unixtime.now()
  }
  await store.set([{ yek, lav }])
  NodeEvent.registerEvent('updated', args.nid, {
    text: args.text,
    index_text: args.index_text,
  })
  return { ack: true }
}

async function prepareNodeRemoval(
  store: YekLavStore,
  nids: Nid[]
): Promise<{
  toRemove: Yek[]
  toSet: YekLav[]
}> {
  const toRemove: Yek[] = []
  const toSet: YekLav[] = []
  // Remove nodes themselves
  toRemove.push(
    ...nids.map((nid): NidToNodeYek => {
      return { yek: { kind: 'nid->node', key: nid } }
    })
  )
  // eslint-disable-next-line no-lone-blocks
  {
    // Remove edges of impacted nodes
    toRemove.push(
      ...nids.map((nid): NidToEdgeYek => {
        return { yek: { kind: 'nid->edge', key: nid } }
      })
    )

    // Remove the bi-directional copies of the removed edges
    for (const removedNid of nids) {
      const yek: NidToEdgeYek = { yek: { kind: 'nid->edge', key: removedNid } }
      const edges: TEdgeJson[] = (await store.get(yek))?.lav.value ?? []
      const linkedNids: Nid[] = edges.map((edge) =>
        edge.from_nid === removedNid ? edge.to_nid : edge.from_nid
      )
      for (const linkedNid of linkedNids) {
        const linkedYek: NidToEdgeYek = {
          yek: { kind: 'nid->edge', key: linkedNid },
        }
        toSet.push(await store.prepareRemoval(linkedYek, [removedNid]))
      }
    }
  }

  // eslint-disable-next-line no-lone-blocks
  {
    // Remove nids from 'all-nids' array
    toSet.push(
      await store.prepareRemoval(
        { yek: { kind: 'all-nids', key: undefined } },
        nids
      )
    )
  }
  {
    // Remove nids from their respective 'origin->nid' arrays
    const isNotUndefined = (value: YekLav | undefined): value is YekLav =>
      value != null
    const yeklavs: YekLav[] = await Promise.all(
      nids.map(async (nid): Promise<YekLav | undefined> => {
        const origin: OriginId | undefined = (
          await store.get({ yek: { kind: 'nid->node', key: nid } })
        )?.lav.auxiliary?.origin
        return origin != null
          ? store.prepareRemoval(
              { yek: { kind: 'origin->nid', key: origin } },
              [nid]
            )
          : undefined
      })
    ).then((yeklavs) => yeklavs.filter(isNotUndefined))
    toSet.push(...yeklavs)
  }
  // Remove assosiated Similarity search info
  toRemove.push(
    ...nids.map((nid): NidToNodeSimilaritySearchInfoYek => {
      return { yek: { kind: 'nid->sim-search-node', key: nid } }
    })
  )
  // TODO[snikitin@outlook.com] If a node was uploaded via UserExternalPipelineId,
  // its nid should be cleaned up from the corresponding ExtPipelineToNidYek.
  return { toRemove, toSet }
}

async function deleteNode(
  store: YekLavStore,
  args: NodeDeleteArgs
): Promise<Ack> {
  NodeEvent.registerEvent('will-delete', args.nid, {})
  const { toRemove, toSet } = await prepareNodeRemoval(store, [args.nid])
  await store.remove(toRemove)
  await store.set(toSet)
  return { ack: true }
}

async function bulkDeleteNodes(
  store: YekLavStore,
  args: NodeBulkDeleteArgs
): Promise<number /* number of nodes deleted */> {
  if (!('autoIngestion' in args.createdVia)) {
    throw new Error(
      `Tried to bulk-delete nodes via an unimplemented criteria: ${JSON.stringify(
        args.createdVia
      )}`
    )
  }
  const epid: UserExternalPipelineId = args.createdVia.autoIngestion

  // Remove traces of impacted external pipeline ID
  const extPipelineYek: ExtPipelineYek = {
    yek: { kind: 'ext-pipe-id->progress', key: epid },
  }
  const extPipelineToNidYek: ExtPipelineToNidYek = {
    yek: { kind: 'ext-pipe-id->nid', key: epid },
  }
  const nids: Nid[] =
    (await store.get(extPipelineToNidYek))?.lav.value.map(
      (element) => element.nid
    ) ?? []

  // Remove everything else associated with the nodes
  const { toRemove, toSet } = await prepareNodeRemoval(store, nids)

  await store.remove(toRemove.concat([extPipelineYek, extPipelineToNidYek]))
  await store.set(toSet)

  return nids.length
}

async function getNodeSimilaritySearchInfo(
  store: YekLavStore,
  { nid }: NodeGetArgs
): Promise<NodeSimilaritySearchInfo> {
  const yek: NidToNodeSimilaritySearchInfoYek = {
    yek: { kind: 'nid->sim-search-node', key: nid },
  }
  const lav: NidToNodeSimilaritySearchInfoLav | undefined = await store.get(yek)
  const value: NodeSimilaritySearchInfo | null = lav?.lav?.value ?? null
  return value
}

async function setNodeSimilaritySearchInfo(
  store: YekLavStore,
  { nid, simsearch }: SetNodeSimilaritySearchInfoArgs
): Promise<Ack> {
  const yek: NidToNodeSimilaritySearchInfoYek = {
    yek: { kind: 'nid->sim-search-node', key: nid },
  }
  const lav: NidToNodeSimilaritySearchInfoLav = {
    lav: {
      kind: 'nid->sim-search-node',
      value: simsearch,
    },
  }
  await store.set([{ yek, lav }])
  return { ack: true }
}

async function deleteNodeSimilaritySearchInfo(
  store: YekLavStore,
  { nid }: NodeDeleteArgs
): Promise<Ack> {
  const yek: NidToNodeSimilaritySearchInfoYek = {
    yek: { kind: 'nid->sim-search-node', key: nid },
  }
  await store.remove([yek])
  return { ack: true }
}

class Iterator implements INodeIterator {
  private store: YekLavStore
  private nids: Nid[]
  private index: number

  constructor(store: YekLavStore, nids: Nid[]) {
    this.store = store
    this.index = 0
    this.nids = nids
  }

  static async create(store: YekLavStore): Promise<Iterator> {
    const nids = await getAllNids(store, {})
    return new Iterator(store, nids)
  }

  async next(): Promise<TNode | null> {
    const nids = this.nids
    if (this.index >= nids.length) {
      return null
    }
    const nid: Nid = nids[this.index]
    const yek: NidToNodeYek = { yek: { kind: 'nid->node', key: nid } }
    const lav: NidToNodeLav | undefined = await this.store.get(yek)
    if (lav == null) {
      throw new Error(`Failed to find node for nid ${nid}`)
    }
    ++this.index
    return NodeUtil.fromJson(lav.lav.value)
  }
  total(): number {
    return this.index
  }
  abort(): void {
    this.index = 0
    this.nids = []
  }
}

async function createEdge(
  store: YekLavStore,
  args: EdgeCreateArgs
): Promise<TEdge> {
  const createdAt: number = unixtime.now()
  const edge: TEdgeJson = {
    eid: generateEid(),
    from_nid: args.from,
    to_nid: args.to,
    crtd: createdAt,
    upd: createdAt,
    is_sticky: false,
  }

  const items: YekLav[] = []
  {
    const yek: NidToEdgeYek = { yek: { kind: 'nid->edge', key: args.from } }
    const lav: NidToEdgeLav = { lav: { kind: 'nid->edge', value: [edge] } }
    items.push(await store.prepareAppend(yek, lav))
  }
  {
    const yek: NidToEdgeYek = { yek: { kind: 'nid->edge', key: args.to } }
    const lav: NidToEdgeLav = { lav: { kind: 'nid->edge', value: [edge] } }
    items.push(await store.prepareAppend(yek, lav))
  }
  await store.set(items)
  return EdgeUtil.fromJson(edge)
}

async function getNodeAllEdges(
  store: YekLavStore,
  { nid }: EdgeGetArgs
): Promise<NodeEdges> {
  const yek: NidToEdgeYek = { yek: { kind: 'nid->edge', key: nid } }
  const lav: NidToEdgeLav | undefined = await store.get(yek)
  const ret: NodeEdges = { from_edges: [], to_edges: [] }
  if (lav == null) {
    return ret
  }
  for (const edge of lav.lav.value) {
    if (edge.to_nid === nid) {
      ret.from_edges.push(EdgeUtil.fromJson(edge))
    } else {
      ret.to_edges.push(EdgeUtil.fromJson(edge))
    }
  }
  return ret
}

async function addExternalUserActivity(
  store: YekLavStore,
  { origin, activity }: ActivityExternalAddArgs
): Promise<TotalUserActivity> {
  const yek: OriginToActivityYek = {
    yek: { kind: 'origin->activity', key: origin },
  }
  const oldLav: OriginToActivityLav | undefined = await store.get(yek)
  const value: NonNullable<typeof oldLav>['lav']['value'] = oldLav?.lav
    .value ?? {
    visits: [],
    attentions: [],
    total_seconds_of_attention: 0,
  }

  if ('visit' in activity && activity.visit != null) {
    const newVisits: (ResourceVisit & {
      reported_by?: UserExternalPipelineId
    })[] = activity.visit.visits.map((visit: ResourceVisit) => {
      return { ...visit, reported_by: activity.visit?.reported_by }
    })
    value.visits = value.visits.concat(newVisits)
  } else if ('attention' in activity && activity.attention != null) {
    value.attentions.push(activity.attention)
    value.total_seconds_of_attention += activity.attention.seconds
  } else {
    throw new Error(
      `Can't add external user activity, invalid request ${JSON.stringify(
        activity
      )}`
    )
  }

  const newLav: OriginToActivityLav = {
    lav: { kind: 'origin->activity', value },
  }
  await store.set([{ yek, lav: newLav }])
  return {
    visits: value.visits,
    seconds_of_attention: value.total_seconds_of_attention,
  }
}

async function getExternalUserActivity(
  store: YekLavStore,
  { origin }: ActivityExternalGetArgs
): Promise<TotalUserActivity> {
  const yek: OriginToActivityYek = {
    yek: { kind: 'origin->activity', key: origin },
  }
  const lav: OriginToActivityLav | undefined = await store.get(yek)
  if (lav == null) {
    return {
      visits: [],
      seconds_of_attention: 0,
    }
  }
  const value = lav.lav.value
  return {
    visits: value.visits,
    seconds_of_attention: value.total_seconds_of_attention,
  }
}

async function getUserIngestionProgress(
  store: YekLavStore,
  { epid }: ExternalIngestionGetArgs
): Promise<UserExternalPipelineIngestionProgress> {
  const yek: ExtPipelineYek = {
    yek: { kind: 'ext-pipe-id->progress', key: epid },
  }
  const lav: ExtPipelineLav | undefined = await store.get(yek)
  if (lav == null) {
    return {
      epid,
      ingested_until: 0,
    }
  }
  const value: UserExternalPipelineIngestionProgress = {
    epid,
    ...lav.lav.value,
  }
  return value
}

async function advanceUserIngestionProgress(
  store: YekLavStore,
  { epid, new_progress }: ExternalIngestionAdvanceArgs
): Promise<Ack> {
  const progress: UserExternalPipelineIngestionProgress =
    await getUserIngestionProgress(store, { epid })
  progress.ingested_until = new_progress.ingested_until

  const yek: ExtPipelineYek = {
    yek: { kind: 'ext-pipe-id->progress', key: epid },
  }
  const lav: ExtPipelineLav = {
    lav: { kind: 'ext-pipe-id->progress', value: progress },
  }
  await store.set([{ yek, lav }])
  return { ack: true }
}

async function getAllNids(
  store: YekLavStore,
  _args: NodeGetAllNidsArgs
): Promise<Nid[]> {
  const yek: AllNidsYek = { yek: { kind: 'all-nids', key: undefined } }
  const lav: AllNidsLav | undefined = await store.get(yek)
  if (lav == null) {
    return []
  }
  const tags = lav?.lav.value ?? []
  // Sort tags by creation date, latest first
  tags.sort((a, b) => b.created_at - a.created_at)
  const nids = tags.map((t) => t.nid)
  return nids
}

async function recordAssociation(
  store: YekLavStore,
  args: ActivityAssociationRecordArgs
): Promise<Ack> {
  const { from, to } = args.origin
  const yek: OriginToExtAssociationYek = {
    yek: { kind: 'origin->ext-assoc', key: from },
  }
  const reverseYek: OriginToExtAssociationYek = {
    yek: { kind: 'origin->ext-assoc', key: to },
  }
  const orEmpty = (
    input: OriginToExtAssociationLav | undefined
  ): OriginToExtAssociationLav => {
    return input != null
      ? input
      : { lav: { kind: 'origin->ext-assoc', value: [] } }
  }
  const [lav, rlav]: OriginToExtAssociationLav[] = await Promise.all([
    store.get(yek).then(orEmpty),
    store.get(reverseYek).then(orEmpty),
  ])

  if (!lav.lav.value.every((assoc) => assoc.other.id !== to.id)) {
    // Don't fail here, user might open the same link many times, there is
    // nothing unusual in it.
    log.debug(`${from.id} -> ${to.id} association already exists.`)
    return { ack: true }
  }
  if (!rlav.lav.value.every((assoc) => assoc.other.id !== from.id)) {
    throw new Error(
      `${from.id} -> ${to.id} association does not exist, but its reverse version does. Data is unexpectedly inconsistent.`
    )
  }

  lav.lav.value.push({
    direction: 'to',
    other: to,
    association: args.body.association,
  })
  rlav.lav.value.push({
    direction: 'from',
    other: from,
    association: args.body.association,
  })
  await store.set([
    { yek, lav },
    { yek: reverseYek, lav: rlav },
  ])
  return { ack: true }
}

async function getAssociations(
  store: YekLavStore,
  args: ActivityAssociationGetArgs
): Promise<GetUserExternalAssociationsResponse> {
  let value: OriginToExtAssociationValue[] = []
  // Step 1: get all association records
  {
    const yek: OriginToExtAssociationYek = {
      yek: { kind: 'origin->ext-assoc', key: args.origin },
    }
    const lav: OriginToExtAssociationLav | undefined = await store.get(yek)
    value = lav?.lav.value ?? []
  }
  if (value.length === 0) {
    return { from: [], to: [] }
  }
  const originToNids = new Map<OriginHash, Nid[]>()
  // Step 2: get nids of all origins found in association records
  {
    const yeks: OriginToNidYek[] = value.map(
      (v: OriginToExtAssociationValue) => {
        return {
          yek: { kind: 'origin->nid', key: v.other },
        }
      }
    )
    yeks.push({ yek: { kind: 'origin->nid', key: args.origin } })
    const yeklavs: {
      yek: OriginToNidYek
      lav: OriginToNidLav
    }[] = await store.get(yeks)
    for (const { yek, lav } of yeklavs) {
      originToNids.set(
        yek.yek.key.id,
        lav.lav.value.map(({ nid }) => nid)
      )
    }
  }
  const ret: GetUserExternalAssociationsResponse = { from: [], to: [] }
  const makeAssociationEnd = (
    origin_hash: OriginHash
  ): ExternalAssociationEnd => {
    return { origin_hash, nids: originToNids.get(origin_hash) ?? [] }
  }

  // Step 3: enrich association records with nids connected to their origins
  value.forEach((association) => {
    switch (association.direction) {
      case 'from': {
        ret.from.push({
          from: makeAssociationEnd(association.other.id),
          to: makeAssociationEnd(args.origin.id),
          association: association.association,
        })
        return
      }
      case 'to': {
        ret.to.push({
          from: makeAssociationEnd(args.origin.id),
          to: makeAssociationEnd(association.other.id),
          association: association.association,
        })
        return
      }
    }
  })
  return ret
}

async function getUserAccountInforFromLocalStorage(
  store: YekLavStore,
  _args: AccountInfoGetArgs
): Promise<AccountInfo | null> {
  const yek: UserAccountInfoYek = {
    yek: { kind: 'account-info', key: undefined },
  }
  const lav: UserAccountInfoLav | undefined = await store.get(yek)
  if (lav == null) {
    return null
  }
  return lav.lav.value
}

async function setUserAccountInfoToLocalStorage(
  store: YekLavStore,
  args: AccountInfoSetArgs
): Promise<Ack> {
  const yek: UserAccountInfoYek = {
    yek: { kind: 'account-info', key: undefined },
  }
  if (args.accountInfo != null) {
    const lav: UserAccountInfoLav = {
      lav: { kind: 'account-info', value: args.accountInfo },
    }
    await store.set([{ yek, lav }])
  } else {
    await store.remove([yek])
  }
  return { ack: true }
}

export function makeBrowserExtStorageApi(
  browserStore: browser.Storage.StorageArea
): StorageApi {
  const store = new YekLavStore(browserStore)

  const throwUnimplementedError = (endpoint: string) => {
    return (..._: any[]): never => {
      throw new Error(
        `Attempted to call an ${endpoint} endpoint of browser ` +
          "extension's local StorageApi which hasn't been implemented yet"
      )
    }
  }

  return {
    node: {
      get: (args: NodeGetArgs) => getNode(store, args),
      getByOrigin: (args: NodeGetByOriginArgs) => getNodesByOrigin(store, args),
      getAllNids: (args: NodeGetAllNidsArgs) => getAllNids(store, args),
      update: (args: NodeUpdateArgs) => updateNode(store, args),
      create: (args: NodeCreateArgs) => createNode(store, args),
      iterate: () => Iterator.create(store),
      delete: (args: NodeDeleteArgs) => deleteNode(store, args),
      bulkDelete: (args: NodeBulkDeleteArgs) => bulkDeleteNodes(store, args),
      batch: {
        get: (args: NodeBatchRequestBody) => getNodeBatch(store, args),
      },
      url: throwUnimplementedError('node.url'),
      addListener: NodeEvent.addListener,
      removeListener: NodeEvent.removeListener,
      similarity: {
        getIndex: (args: NodeGetArgs) =>
          getNodeSimilaritySearchInfo(store, args),
        setIndex: (args: SetNodeSimilaritySearchInfoArgs) =>
          setNodeSimilaritySearchInfo(store, args),
        removeIndex: (args: NodeDeleteArgs) =>
          deleteNodeSimilaritySearchInfo(store, args),
      },
    },
    // TODO[snikitin@outlook.com] At the time of this writing blob.upload and
    // blob_index.build are used together to create a single searchable blob node.
    // blob.upload is easy to implement for local storage while blob_index.build
    // is more difficult. Given how important search is for Foreword goals at the
    // time of writing, it makes little sense to implement any of them until
    // blob_index.build is usable.
    blob: {
      upload: throwUnimplementedError('blob.upload'),
      sourceUrl: throwUnimplementedError('blob.sourceUrl'),
    },
    blob_index: {
      build: throwUnimplementedError('blob_index.build'),
      cfg: {
        supportsMime: (_mimeType: MimeType) => false,
      },
    },
    edge: {
      create: (args: EdgeCreateArgs) => createEdge(store, args),
      get: (args: EdgeGetArgs) => getNodeAllEdges(store, args),
      sticky: throwUnimplementedError('edge.sticky'),
      delete: throwUnimplementedError('edge.delete'),
    },
    activity: {
      external: {
        add: (args: ActivityExternalAddArgs) =>
          addExternalUserActivity(store, args),
        get: (args: ActivityExternalGetArgs) =>
          getExternalUserActivity(store, args),
      },
      association: {
        record: (args: ActivityAssociationRecordArgs) =>
          recordAssociation(store, args),
        get: (args: ActivityAssociationGetArgs) => getAssociations(store, args),
      },
    },
    external: {
      ingestion: {
        get: (args: ExternalIngestionGetArgs) =>
          getUserIngestionProgress(store, args),
        advance: (args: ExternalIngestionAdvanceArgs) =>
          advanceUserIngestionProgress(store, args),
      },
    },
    account: {
      info: {
        get: (args: AccountInfoGetArgs) =>
          getUserAccountInforFromLocalStorage(store, args),
        set: (args: AccountInfoSetArgs) =>
          setUserAccountInfoToLocalStorage(store, args),
      },
    },
  }
}
