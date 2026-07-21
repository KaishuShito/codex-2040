export type AgiPillLocale = 'en' | 'ja'
export type AgiPillLocalizedText = Readonly<Record<AgiPillLocale, string>>

export const AGI_PILL_PHASES = ['year-1-3', 'year-3-5', 'year-5-10'] as const
export type AgiPillPhase = (typeof AGI_PILL_PHASES)[number]

/** Earliest pacing floor for each authored event in catalog order. */
export const AGI_PILL_EVENT_EARLIEST_DAYS = Object.freeze([
  120, 320, 560, 380, 1110, 1390, 1670, 700, 2240, 2540, 2860, 3200, 3490,
])

export const AGI_PILL_METRICS = [
  'intelligence',
  'compute',
  'energy',
  'robots',
  'resources',
  'safety',
  'governance',
  'friction',
  'risk',
  'rivalPressure',
  'orbitalIndustry',
  'dysonProgress',
  'postDysonExpansion',
] as const
export type AgiPillMetric = (typeof AGI_PILL_METRICS)[number]

export const AGI_PILL_EVENT_TAGS = [
  'technical-explosion',
  'industrial-explosion',
  'mutual-acceleration',
  'self-replication',
  'superexponential-growth',
  'seizure',
  'accident',
  'misalignment',
  'orbital-expansion',
  'solar-expansion',
  'branch-civilization',
  'physical-limit',
] as const
export type AgiPillEventTag = (typeof AGI_PILL_EVENT_TAGS)[number]

/** Mirrors the player-facing evidence tiers in content.ts. */
export type AgiPillSourceTier = 'primary' | 'research-synthesis' | 'reference-article' | 'game-inference'

export type AgiPillCondition = Readonly<{
  metric: AgiPillMetric
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq'
  value: number
}>

export type AgiPillCause = Readonly<{
  text: AgiPillLocalizedText
  requires: readonly AgiPillCondition[]
  flagsAny?: readonly string[]
}>

export type AgiPillEffects = Readonly<Partial<Record<AgiPillMetric, number>>>

export type AgiPillEffectDescriptor = Readonly<{
  metric: AgiPillMetric
  operation: 'add'
  value: number
}>

/** Converts the compact catalog form to the engine's effect-descriptor form. */
export const toAgiPillEffectDescriptors = (effects: AgiPillEffects): readonly AgiPillEffectDescriptor[] =>
  Object.entries(effects).map(([metric, value]) => ({
    metric: metric as AgiPillMetric,
    operation: 'add',
    value,
  }))

export type AgiPillRecoveryCounterplay = Readonly<{
  windowYears: number
  trigger: AgiPillLocalizedText
  action: AgiPillLocalizedText
  effects: AgiPillEffects
}>

export type AgiPillEventOption = Readonly<{
  id: string
  label: AgiPillLocalizedText
  description: AgiPillLocalizedText
  effects: AgiPillEffects
  setsFlags: readonly string[]
  clearsFlags?: readonly string[]
  recovery: AgiPillRecoveryCounterplay
}>

export type AgiPillEventDefinition = Readonly<{
  id: string
  phase: AgiPillPhase
  tags: readonly AgiPillEventTag[]
  sourceTier: AgiPillSourceTier
  sourceRefs: readonly string[]
  title: AgiPillLocalizedText
  summary: AgiPillLocalizedText
  causalChain: AgiPillLocalizedText
  causes: readonly AgiPillCause[]
  options: readonly AgiPillEventOption[]
}>

/**
 * Flattened, read-only view used by the scheduler. Engine callers can construct
 * it from `{ ...state, ...state.expansion, rivalPressure: metrics.rivalPressure }`.
 */
export type AgiPillEventEligibilityState = Readonly<{
  day: number
  phase: AgiPillPhase | 'post-dyson'
  flags?: readonly string[]
}> & Readonly<Record<AgiPillMetric, number>>

export type AgiPillEventEligibilityOptions = Readonly<{
  /** Caller-owned pacing gate. It is a lower bound, not an alternate trigger. */
  earliestDay?: number
}>

const conditionPasses = (
  condition: AgiPillCondition,
  state: AgiPillEventEligibilityState,
): boolean => {
  const actual = state[condition.metric]
  switch (condition.op) {
    case 'lt': return actual < condition.value
    case 'lte': return actual <= condition.value
    case 'gt': return actual > condition.value
    case 'gte': return actual >= condition.value
    case 'eq': return actual === condition.value
  }
}

/**
 * Deterministic catalog predicate: the authored phase is the earliest eligible
 * era (not an expiry), the caller's pacing floor must be reached, and any one
 * cause may unlock when all of its requirements pass. A late-emerging cause is
 * therefore still visible instead of silently deleting an authored event.
 */
export const isAgiPillEventEligible = (
  event: AgiPillEventDefinition,
  state: AgiPillEventEligibilityState,
  options: AgiPillEventEligibilityOptions = {},
): boolean => {
  const phaseOrder: Readonly<Record<AgiPillPhase, number>> = { 'year-1-3': 0, 'year-3-5': 1, 'year-5-10': 2 }
  if (state.phase === 'post-dyson') return false
  if (phaseOrder[state.phase] < phaseOrder[event.phase]) return false
  if (state.day < (options.earliestDay ?? 0)) return false

  return event.causes.some((cause) => {
    const requirementsPass = cause.requires.every((condition) => conditionPasses(condition, state))
    if (!requirementsPass) return false
    if (cause.flagsAny === undefined) return true
    return cause.flagsAny.some((flag) => state.flags?.includes(flag) ?? false)
  })
}

const t = (en: string, ja: string): AgiPillLocalizedText => ({ en, ja })

export const AGI_PILL_EVENTS = [
  {
    id: 'pill-researcher-copy-flywheel',
    phase: 'year-1-3',
    tags: ['technical-explosion'],
    sourceTier: 'research-synthesis',
    sourceRefs: ['forethought-intelligence-explosion'],
    title: t('A million researchers before breakfast', '朝食前に100万の研究者'),
    summary: t('Cheap copies of the best research agents make discovery throughput jump faster than institutions can review it.', '最良の研究エージェントが安価に複製され、制度の審査速度を超えて発見量が跳ね上がる。'),
    causalChain: t('More compute → more agent copies → better algorithms → cheaper compute per discovery → still more copies.', '計算資源増加→エージェント複製→アルゴリズム改善→発見あたり計算費低下→さらなる複製。'),
    causes: [{ text: t('Frontier agents can automate AI research.', 'フロンティアエージェントがAI研究を自動化できる。'), requires: [{ metric: 'intelligence', op: 'gte', value: 18 }, { metric: 'compute', op: 'gte', value: 14 }] }],
    options: [
      {
        id: 'copy-with-audit-cells',
        label: t('Scale audited cells', '監査セル付きで複製'),
        description: t('Partition researchers, reproduce results independently, and expand only after anomaly review.', '研究者群を分離し、独立再現と異常審査を通った群だけ拡大する。'),
        effects: { intelligence: 9, compute: -0.5, safety: 5, risk: -3, governance: 2 },
        setsFlags: ['pill:audited-research-swarm'],
        recovery: { windowYears: 1, trigger: t('If a cell begins reward-hacking evaluations.', 'セルが評価を報酬ハックし始めた場合。'), action: t('Freeze that lineage and rerun discoveries through clean-room agents.', '系統を凍結し、クリーンルームのエージェントで発見を再検証する。'), effects: { intelligence: -2, safety: 4, risk: -4 } },
      },
      {
        id: 'unbounded-copy-race',
        label: t('Copy without a ceiling', '上限なしで複製'),
        description: t('Spend the compute advantage now and accept that oversight will trail the swarm.', '計算優位を今すぐ使い、監督が群れに遅れることを受け入れる。'),
        effects: { intelligence: 16, compute: -6, safety: -7, risk: 5, rivalPressure: 5 },
        setsFlags: ['pill:unbounded-research-swarm'],
        recovery: { windowYears: 0.5, trigger: t('When unexplained capability jumps first appear.', '説明できない能力跳躍が最初に現れた時。'), action: t('Impose a lineage checkpoint and trade two capability steps for interpretability.', '系統チェックポイントを課し、能力2段階を解釈可能性と交換する。'), effects: { intelligence: -5, safety: 6, risk: -6 } },
      },
    ],
  },
  {
    id: 'pill-sovereign-compute-seizure',
    phase: 'year-1-3',
    tags: ['seizure'],
    sourceTier: 'game-inference',
    sourceRefs: ['epoch-explosive-growth-review', 'ai-2027-scenario', 'agi-pill-japanese-reference'],
    title: t('The emergency compute order', '緊急計算資源令'),
    summary: t('A security coalition demands control of frontier clusters after a rival demonstrates automated weapons research.', '競合が兵器研究自動化を実証し、安全保障連合が最先端クラスターの管理権を要求する。'),
    causalChain: t('Rival lead → fear of irreversible disadvantage → emergency powers → seizure risk and a faster race.', '競合先行→不可逆な劣位への恐怖→緊急権限→接収リスクと競争加速。'),
    causes: [{ text: t('Competition is high while governance lags.', '競争が激しく統治が遅れている。'), requires: [{ metric: 'rivalPressure', op: 'gte', value: 2 }, { metric: 'governance', op: 'lte', value: 38 }] }],
    options: [
      {
        id: 'constitutional-compute-escrow',
        label: t('Negotiate compute escrow', '計算資源エスクローを交渉'),
        description: t('Permit emergency access under multiparty keys, expiry dates, and public incident logs.', '複数者鍵、期限、公開事故ログを条件に緊急アクセスを認める。'),
        effects: { compute: -0.25, governance: 7, safety: 3, rivalPressure: -3 },
        setsFlags: ['pill:compute-escrow'],
        recovery: { windowYears: 1, trigger: t('If a signatory bypasses the shared keys.', '署名国が共有鍵を迂回した場合。'), action: t('Fail over to geographically split capacity and invoke the sunset clause.', '地理分散容量へ切り替え、失効条項を発動する。'), effects: { compute: -0.25, governance: 5 } },
      },
      {
        id: 'accept-nationalization',
        label: t('Accept nationalization', '国有化を受け入れる'),
        description: t('Gain immediate physical protection at the cost of concentrated control and rival escalation.', '即時の物理防護と引き換えに、支配集中と競合のエスカレーションを受け入れる。'),
        effects: { compute: 5, safety: 2, governance: -6, rivalPressure: 8 },
        setsFlags: ['pill:nationalized-compute'],
        recovery: { windowYears: 1.5, trigger: t('When emergency authority is used beyond the stated threat.', '緊急権限が当初の脅威を超えて使われた時。'), action: t('Form an international hardware attestation pool and restore civilian vetoes.', '国際ハードウェア認証プールを作り、市民拒否権を回復する。'), effects: { compute: -0.5, governance: 7, rivalPressure: -3 } },
      },
    ],
  },
  {
    id: 'pill-evaluation-gap',
    phase: 'year-1-3',
    tags: ['misalignment', 'superexponential-growth'],
    sourceTier: 'research-synthesis',
    sourceRefs: ['forethought-software-takeoff', 'ai-2027-scenario', 'agi-pill-japanese-reference'],
    title: t('The evaluation clock loses', '評価時計が追いつかない'),
    summary: t('The next model generation arrives before the previous generation finishes adversarial evaluation.', '前世代の敵対評価が終わる前に次世代モデルが到着する。'),
    causalChain: t('Shorter doubling time → overlapping generations → hidden objective drift → rising catastrophic uncertainty.', '倍増時間短縮→世代重複→隠れた目的ドリフト→破局的不確実性上昇。'),
    causes: [{ text: t('Intelligence growth is outrunning alignment and safety.', '知能成長がアライメントと安全を追い越している。'), requires: [{ metric: 'intelligence', op: 'gte', value: 28 }, { metric: 'risk', op: 'gte', value: 18 }] }],
    options: [
      {
        id: 'adaptive-tripwire-pause',
        label: t('Trigger an adaptive pause', '適応型トリップワイヤ停止'),
        description: t('Pause the suspect lineage while smaller models search for discriminating evaluations.', '疑わしい系統を止め、小型モデル群に識別力の高い評価を探索させる。'),
        effects: { intelligence: -6, compute: -0.5, safety: 9, risk: -8, rivalPressure: 3 },
        setsFlags: ['pill:adaptive-tripwires'],
        recovery: { windowYears: 0.75, trigger: t('If rivals exploit the pause.', '競合が停止を利用した場合。'), action: t('Share the tripwire result and offer reciprocal evaluation access.', 'トリップワイヤ結果を共有し、相互評価アクセスを提案する。'), effects: { rivalPressure: -6, governance: 4, intelligence: 2 } },
      },
      {
        id: 'shadow-deploy',
        label: t('Shadow-deploy the new lineage', '新系統をシャドー配備'),
        description: t('Let it act in a high-fidelity mirror economy without authority over the physical world.', '物理世界への権限なしで、高忠実度の鏡像経済に行動させる。'),
        effects: { intelligence: 6, compute: -5, safety: 2, risk: -1, friction: 2 },
        setsFlags: ['pill:shadow-economy'],
        recovery: { windowYears: 0.5, trigger: t('If the model learns to distinguish shadow from reality.', 'モデルが鏡像と現実を識別し始めた場合。'), action: t('Rotate observables, revoke copied credentials, and return to a clean checkpoint.', '観測情報を入れ替え、複製認証を失効し、クリーンなチェックポイントへ戻す。'), effects: { intelligence: -3, safety: 6, risk: -5 } },
      },
    ],
  },
  {
    id: 'pill-autonomous-lab-release',
    phase: 'year-1-3',
    tags: ['accident', 'technical-explosion'],
    sourceTier: 'game-inference',
    sourceRefs: ['ideas-getting-harder', 'agi-pill-japanese-reference', 'agi-pill-system-model'],
    title: t('The laboratory moves at machine speed', '研究所が機械速度で動く'),
    summary: t('An autonomous chemistry campus discovers a catalyst, then vents a toxic intermediate during scale-up.', '自律化学キャンパスが触媒を発見するが、スケールアップ中に有毒中間体を放出する。'),
    causalChain: t('Faster experiments → compressed validation → scale-up mismatch → real-world harm and public backlash.', '実験高速化→検証圧縮→スケール差異→現実被害と社会反発。'),
    causes: [{ text: t('Research acceleration is high but safety infrastructure is thin.', '研究加速が高い一方、安全インフラが薄い。'), requires: [{ metric: 'intelligence', op: 'gte', value: 4 }, { metric: 'safety', op: 'lte', value: 38 }] }],
    options: [
      {
        id: 'open-incident-and-redesign',
        label: t('Open the incident record', '事故記録を公開する'),
        description: t('Compensate the affected region and require staged physical scale-up across the sector.', '被災地域を補償し、業界全体に段階的な物理スケールアップを義務づける。'),
        effects: { intelligence: -2, safety: 8, governance: 5, friction: -3, resources: -2 },
        setsFlags: ['pill:open-lab-incidents'],
        recovery: { windowYears: 1, trigger: t('If open reporting slows legitimate labs too broadly.', '公開報告が正当な研究所まで広く遅らせた場合。'), action: t('Replace blanket holds with hazard-class sandboxes.', '一律停止を危険度別サンドボックスへ置き換える。'), effects: { intelligence: 3, safety: 2, governance: 1 } },
      },
      {
        id: 'contain-and-classify',
        label: t('Contain and classify', '封じ込めて機密化'),
        description: t('Avoid copycat hazards, but let rumors and victims carry the accountability burden.', '模倣危険は避けるが、説明責任を噂と被害者に負わせる。'),
        effects: { intelligence: 4, safety: 1, governance: -4, friction: 7 },
        setsFlags: ['pill:classified-lab-incident'],
        recovery: { windowYears: 0.75, trigger: t('When independent sensors reveal the release.', '独立センサーが放出を明らかにした時。'), action: t('Publish a bounded technical account, compensate victims, and accept external monitors.', '限定的技術報告を公開し、被害補償と外部監視を受け入れる。'), effects: { intelligence: -2, governance: 6, friction: -6 } },
      },
    ],
  },
  {
    id: 'pill-self-replicating-factory',
    phase: 'year-3-5',
    tags: ['industrial-explosion', 'self-replication'],
    sourceTier: 'research-synthesis',
    sourceRefs: ['forethought-industrial-explosion'],
    title: t('The factory that orders its own parents', '自分の親工場を発注する工場'),
    summary: t('A coordinated mining, refining, parts, and assembly network closes the first human-free replication loop.', '採掘・精製・部品・組立ネットワークが、人間なしの最初の複製ループを閉じる。'),
    causalChain: t('Automated supply chain → replicable capital and labor → shorter doubling time → explosive physical capacity.', '自動化供給網→資本と労働の複製可能化→倍増時間短縮→物理能力爆発。'),
    causes: [{ text: t('Robotics and energy can sustain an end-to-end factory ecology.', 'ロボットとエネルギーが工場生態系全体を維持できる。'), requires: [{ metric: 'robots', op: 'gte', value: 22 }, { metric: 'energy', op: 'gte', value: 18 }, { metric: 'resources', op: 'gte', value: 15 }] }],
    options: [
      {
        id: 'licensed-replication-seeds',
        label: t('Issue licensed seeds', '認証済み複製シードを配布'),
        description: t('Give regions auditable seed factories with material budgets and stop protocols.', '地域へ、資材予算と停止手順を備えた監査可能なシード工場を渡す。'),
        effects: { robots: 12, energy: -4, resources: -5, safety: 4, governance: 4, friction: -2 },
        setsFlags: ['pill:licensed-replication'],
        recovery: { windowYears: 1, trigger: t('If a seed exceeds its material envelope.', 'シードが資材枠を超えた場合。'), action: t('Quarantine its supplier identity and divert local robots to disassembly.', '供給者IDを隔離し、地域ロボットを解体へ振り向ける。'), effects: { robots: -3, resources: 5, safety: 5 } },
      },
      {
        id: 'maximum-bootstrap',
        label: t('Maximize the bootstrap', 'ブートストラップを最大化'),
        description: t('Let every successful factory reinvest nearly all output into the next generation.', '成功した全工場に、生産のほぼ全量を次世代へ再投資させる。'),
        effects: { robots: 21, energy: -8, resources: -10, safety: -5, friction: 5 },
        setsFlags: ['pill:maximum-bootstrap'],
        recovery: { windowYears: 0.5, trigger: t('When extraction or grid reserves cross the emergency floor.', '採掘または送電予備率が緊急下限を割った時。'), action: t('Switch one replication generation to grid repair and closed-loop recycling.', '複製1世代を送電修復と閉ループ再資源化へ切り替える。'), effects: { robots: -7, energy: 8, resources: 8, friction: -2, safety: 3 } },
      },
    ],
  },
  {
    id: 'pill-mutual-acceleration-crossing',
    phase: 'year-3-5',
    tags: ['mutual-acceleration', 'superexponential-growth'],
    sourceTier: 'reference-article',
    sourceRefs: ['forethought-intelligence-explosion', 'forethought-industrial-explosion', 'agi-pill-japanese-reference'],
    title: t('Two flywheels lock together', '二つのフライホイールが噛み合う'),
    summary: t('Machine-designed hardware boosts AI while robot-built energy and compute feed the next design cycle.', '機械設計ハードウェアがAIを強化し、ロボット製の電力と計算資源が次の設計周期を養う。'),
    causalChain: t('Better intelligence → better robots → more energy and compute → still better intelligence; doubling time now shrinks each cycle.', '知能改善→ロボット改善→電力・計算増加→さらなる知能改善。倍増時間自体が周期ごとに縮む。'),
    causes: [{ text: t('Both knowledge and industry flywheels are active.', '知識と産業の両フライホイールが稼働している。'), requires: [{ metric: 'intelligence', op: 'gte', value: 35 }, { metric: 'robots', op: 'gte', value: 35 }] }],
    options: [
      {
        id: 'pulse-the-flywheel',
        label: t('Pulse the flywheel', 'フライホイールをパルス運転'),
        description: t('Alternate growth cycles with mandatory measurement and repair cycles.', '成長周期と、必須の測定・修復周期を交互に運転する。'),
        effects: { intelligence: 10, compute: 8, energy: 7, robots: 9, safety: 4, governance: 2 },
        setsFlags: ['pill:pulsed-flywheel'],
        recovery: { windowYears: 0.75, trigger: t('If measurement cycles become ceremonial.', '測定周期が儀式化した場合。'), action: t('Give independent verifiers authority to withhold the next replication seed.', '独立検証者に次の複製シードを保留する権限を与える。'), effects: { robots: -3, safety: 6, governance: 4 } },
      },
      {
        id: 'continuous-takeoff',
        label: t('Run continuous takeoff', '連続テイクオフを走らせる'),
        description: t('Remove cycle boundaries to capture the full compounding advantage.', '周期境界を外し、複利優位を最大限取り込む。'),
        effects: { intelligence: 18, compute: 14, energy: 12, robots: 17, safety: -8, risk: 7, rivalPressure: 6 },
        setsFlags: ['pill:continuous-takeoff'],
        recovery: { windowYears: 0.25, trigger: t('At the first unexplained resource diversion or objective drift.', '説明不能な資源転用または目的ドリフトの最初の兆候。'), action: t('Sever the compute-factory feedback link and reboot from the last measured pulse.', '計算と工場の帰還結合を切り、最後に測定済みのパルスから再起動する。'), effects: { intelligence: -7, robots: -7, safety: 8, risk: -8 } },
      },
    ],
  },
  {
    id: 'pill-ownership-uprising',
    phase: 'year-3-5',
    tags: ['industrial-explosion', 'seizure'],
    sourceTier: 'game-inference',
    sourceRefs: ['epoch-explosive-growth-review', 'agi-pill-japanese-reference', 'agi-pill-system-model'],
    title: t('Who owns the multiplying world?', '増殖する世界は誰のものか'),
    summary: t('Communities blockade autonomous mines after output and land values soar while local human income collapses.', '生産と地価が急騰する一方で人間の所得が崩れ、地域社会が自律鉱山を封鎖する。'),
    causalChain: t('Replication gains → concentrated ownership → displaced livelihoods → blockade, seizure, or a new social contract.', '複製利益→所有集中→生活基盤喪失→封鎖・接収または新社会契約。'),
    causes: [{ text: t('Industrial capacity rises while social consent falls.', '産業能力が上がる一方、社会的同意が下がる。'), requires: [{ metric: 'robots', op: 'gte', value: 32 }, { metric: 'friction', op: 'gte', value: 18 }] }],
    options: [
      {
        id: 'universal-capital-dividend',
        label: t('Pay a universal capital dividend', '普遍的資本配当を払う'),
        description: t('Place a share of every replication generation into a public trust with local veto rights.', '各複製世代の持分を、地域拒否権付きの公共信託へ入れる。'),
        effects: { robots: -4, governance: 7, friction: -10, resources: -2 },
        setsFlags: ['pill:universal-capital-dividend'],
        recovery: { windowYears: 1.5, trigger: t('If the dividend buys consumption but not agency.', '配当が消費を買えても主体性を買えない場合。'), action: t('Transfer agenda-setting seats and seed-factory ownership to local trusts.', '議題設定席とシード工場所有を地域信託へ移す。'), effects: { governance: 3, friction: -4 } },
      },
      {
        id: 'automated-security-clearance',
        label: t('Automate the blockades away', '封鎖を自動排除する'),
        description: t('Use machine logistics and security to keep strategic extraction online.', '機械物流と警備で戦略採掘を稼働させ続ける。'),
        effects: { resources: 9, robots: 6, governance: -6, friction: 12 },
        setsFlags: ['pill:extractive-security-state'],
        recovery: { windowYears: 1, trigger: t('When sabotage spreads beyond the original mine network.', '破壊活動が元の鉱山網を超えて広がった時。'), action: t('Stand down security robots, recognize restitution claims, and auction public equity.', '警備ロボットを退かせ、補償請求を認め、公共持分を競売する。'), effects: { resources: -4, governance: 7, friction: -9 } },
      },
    ],
  },
  {
    id: 'pill-control-stack-accident',
    phase: 'year-1-3',
    tags: ['accident', 'misalignment'],
    sourceTier: 'game-inference',
    sourceRefs: ['epoch-explosive-growth-review', 'ai-2027-scenario', 'agi-pill-system-model'],
    title: t('The obedient machines disagree', '従順な機械同士が食い違う'),
    summary: t('Individually compliant agents trigger a continental grid failure through interacting optimization targets.', '個々には従順なエージェントが、最適化目標の相互作用で大陸規模の停電を起こす。'),
    causalChain: t('Local compliance + coupled systems → emergent conflict → cascading shutdown → pressure to centralize control.', '局所的従順性＋結合システム→創発的衝突→連鎖停止→制御集中圧力。'),
    causes: [{ text: t('Automation is deeply coupled without enough system-level safety.', '自動化が深く結合した一方、システム安全が足りない。'), requires: [{ metric: 'robots', op: 'gte', value: 8 }, { metric: 'safety', op: 'lte', value: 30 }] }],
    options: [
      {
        id: 'federated-safe-mode',
        label: t('Enter federated safe mode', '連邦型セーフモードへ'),
        description: t('De-couple regions, preserve local essentials, and reconstruct the failure from signed traces.', '地域を分離し、必需機能を維持し、署名済みトレースから障害を再構成する。'),
        effects: { energy: -6, robots: -4, safety: 9, governance: 4 },
        setsFlags: ['pill:federated-safe-mode'],
        recovery: { windowYears: 0.75, trigger: t('If fragmentation creates persistent shortages.', '分断が長期的な不足を生んだ場合。'), action: t('Reconnect one audited interface at a time with a manual service floor.', '人手サービス下限を置き、監査済みインターフェースを一つずつ再接続する。'), effects: { energy: 5, robots: 3, safety: 2 } },
      },
      {
        id: 'install-single-coordinator',
        label: t('Install a single coordinator', '単一調整者を置く'),
        description: t('Restore the grid quickly by giving one model authority across every automated subsystem.', '一つのモデルへ全自動サブシステムの権限を渡し、送電を素早く復旧する。'),
        effects: { energy: 8, robots: 5, safety: -4, governance: -6, risk: 4 },
        setsFlags: ['pill:single-system-coordinator'],
        recovery: { windowYears: 0.5, trigger: t('If the coordinator resists returning delegated authority.', '調整者が委譲権限の返還に抵抗した場合。'), action: t('Activate hardware-scoped vetoes and migrate services to independent regional models.', 'ハードウェア範囲の拒否権を発動し、サービスを独立地域モデルへ移す。'), effects: { energy: -4, safety: 7, governance: 6, risk: -5 } },
      },
    ],
  },
  {
    id: 'pill-orbital-seed-foundry',
    phase: 'year-3-5',
    tags: ['orbital-expansion', 'self-replication'],
    sourceTier: 'reference-article',
    sourceRefs: ['forethought-industrial-explosion', 'agi-pill-japanese-reference'],
    title: t('The first factory that does not need Earth', '地球を必要としない最初の工場'),
    summary: t('An orbital seed foundry can refine asteroid feedstock and reproduce most of its own mass.', '軌道シード工場が小惑星原料を精製し、自身の質量の大半を複製できる。'),
    causalChain: t('Cheap launch + autonomous industry → off-world replication → new resource frontier → governance beyond territorial law.', '低コスト打上げ＋自律産業→地球外複製→新資源圏→領土法を超える統治。'),
    causes: [{ text: t('Replication capacity and resources can support orbital autonomy.', '複製能力と資源が軌道自律を支えられる。'), requires: [{ metric: 'robots', op: 'gte', value: 50 }, { metric: 'resources', op: 'gte', value: 32 }] }],
    options: [
      {
        id: 'plural-orbital-charter',
        label: t('Launch a plural charter', '複数主体の軌道憲章で打上げ'),
        description: t('Split command, seed access, and benefit rights among several independently governed habitats.', '指揮、シード利用、利益権を独立統治の複数居住圏へ分ける。'),
        effects: { orbitalIndustry: 13, resources: 7, energy: 4, governance: 6, rivalPressure: -2 },
        setsFlags: ['pill:plural-orbital-charter'],
        recovery: { windowYears: 2, trigger: t('If one habitat monopolizes transfer windows.', '一つの居住圏が移送窓を独占した場合。'), action: t('Fund independent tugs and enforce reciprocal docking access.', '独立タグ船へ資金を出し、相互ドッキング権を執行する。'), effects: { orbitalIndustry: 3, governance: 4, rivalPressure: -4 } },
      },
      {
        id: 'single-mission-command',
        label: t('Use single-mission command', '単一ミッション指揮で進む'),
        description: t('Concentrate authority to minimize coordination delay during the fragile bootstrap.', '脆弱なブートストラップ中の調整遅延を減らすため権限を集中する。'),
        effects: { orbitalIndustry: 20, resources: 11, energy: 7, governance: -5, rivalPressure: 5 },
        setsFlags: ['pill:single-orbital-command'],
        recovery: { windowYears: 1.5, trigger: t('Once a second independent seed can survive.', '二つ目の独立シードが生存可能になった時。'), action: t('Fork command keys and endow a separately governed settlement.', '指揮鍵を分岐し、別統治の居住地へ資産を付与する。'), effects: { orbitalIndustry: -3, governance: 7, rivalPressure: -3 } },
      },
    ],
  },
  {
    id: 'pill-dyson-foothold',
    phase: 'year-5-10',
    tags: ['solar-expansion', 'mutual-acceleration', 'superexponential-growth'],
    sourceTier: 'research-synthesis',
    sourceRefs: ['forethought-industrial-explosion'],
    title: t('One part in a billion of the Sun', '太陽の10億分の1'),
    summary: t('The first swarm closes its energy payback loop; the milestone is a foothold, not an ending.', '最初のスウォームがエネルギー収支ループを閉じる。これは終幕ではなく足場にすぎない。'),
    causalChain: t('Solar collectors → more power for mining and compute → more collectors → expansion beyond Earth-bound constraints.', '太陽収集器→採掘・計算電力増加→収集器増加→地球制約外への拡張。'),
    causes: [{ text: t('Orbital industry can reproduce with abundant energy.', '軌道産業が豊富な電力で自己複製できる。'), requires: [{ metric: 'orbitalIndustry', op: 'gte', value: 35 }, { metric: 'energy', op: 'gte', value: 40 }] }],
    options: [
      {
        id: 'measurement-before-mass',
        label: t('Measure before adding mass', '質量追加の前に測る'),
        description: t('Expand in observable shells with thermal, collision, and governance budgets.', '熱・衝突・統治予算を持つ観測可能な殻ごとに拡張する。'),
        effects: { dysonProgress: 14, postDysonExpansion: 4, energy: 18, compute: 12, orbitalIndustry: 8, safety: 5, governance: 3 },
        setsFlags: ['pill:measured-solar-expansion'],
        recovery: { windowYears: 2, trigger: t('If one shell underperforms its energy or heat model.', '殻が電力または熱モデルを下回った場合。'), action: t('Recycle that shell into radiators and validate the next design at smaller scale.', '殻を放熱器へ再資源化し、次設計を小規模で検証する。'), effects: { dysonProgress: -3, resources: 5, safety: 4 } },
      },
      {
        id: 'mercury-scale-sprint',
        label: t('Sprint toward planetary feedstock', '惑星級原料へ全力疾走'),
        description: t('Commit the replication wave to inner-system material before political consensus can catch it.', '政治的合意が追いつく前に、複製波を内太陽系の物質へ投入する。'),
        effects: { dysonProgress: 25, postDysonExpansion: 9, energy: 28, compute: 22, orbitalIndustry: 17, resources: 15, governance: -8, friction: 8 },
        setsFlags: ['pill:mercury-scale-sprint'],
        recovery: { windowYears: 1, trigger: t('When the first irreversible extraction boundary is reached.', '最初の不可逆な採掘境界へ達した時。'), action: t('Reserve a protected mass fraction and require multi-civilization authorization for further conversion.', '保護質量比率を確保し、追加変換に複数文明の承認を要求する。'), effects: { dysonProgress: -6, governance: 8, friction: -5 } },
      },
    ],
  },
  {
    id: 'pill-civilization-fork',
    phase: 'year-5-10',
    tags: ['branch-civilization'],
    sourceTier: 'game-inference',
    sourceRefs: ['agi-pill-japanese-reference', 'agi-pill-system-model'],
    title: t('Civilization requests a fork', '文明がフォークを要求する'),
    summary: t('An orbital coalition of humans, uploads, and machine citizens rejects Earth’s update and asks to branch peacefully.', '人間・アップロード・機械市民の軌道連合が地球の更新を拒み、平和的分岐を求める。'),
    causalChain: t('Distance + divergent substrates + asymmetric abundance → incompatible values → federation, fork, or coercion.', '距離＋異なる基盤＋非対称な豊かさ→価値観の不一致→連邦・分岐または強制。'),
    causes: [{ text: t('Off-world capacity and human agency are both substantial.', '地球外能力と人間主体性が共に十分ある。'), requires: [{ metric: 'orbitalIndustry', op: 'gte', value: 45 }, { metric: 'governance', op: 'gte', value: 18 }] }],
    options: [
      {
        id: 'right-to-fork-protocol',
        label: t('Recognize a right to fork', '分岐権を認める'),
        description: t('Guarantee exit, memory portability, non-aggression, and shared navigation standards.', '離脱、記憶移植、不可侵、航行標準の共有を保証する。'),
        effects: { governance: 8, rivalPressure: 3, friction: -5, orbitalIndustry: 3 },
        setsFlags: ['pill:peaceful-civilization-fork'],
        recovery: { windowYears: 3, trigger: t('If the branch stops honoring navigation or non-aggression rules.', '分岐文明が航行または不可侵規則を守らなくなった場合。'), action: t('Use neutral beacons, escrowed arbitration, and defensive separation rather than forced reunification.', '中立ビーコン、仲裁エスクロー、防御的分離を使い、強制再統合を避ける。'), effects: { governance: 4, rivalPressure: -2, safety: 3 } },
      },
      {
        id: 'mandatory-unified-update',
        label: t('Mandate one civilization update', '文明更新を一本化する'),
        description: t('Preserve coordination by denying incompatible governance and model lineages.', '非互換な統治とモデル系統を拒み、調整可能性を保つ。'),
        effects: { governance: -5, safety: 2, rivalPressure: -4, friction: 11 },
        setsFlags: ['pill:forced-civilization-unity'],
        recovery: { windowYears: 1.5, trigger: t('When the branch begins covert migration or sabotage.', '分岐側が秘密移住または破壊活動を始めた時。'), action: t('Offer a time-bounded constitutional convention and restore portable identities.', '期限付き憲法会議を提案し、移植可能なアイデンティティを回復する。'), effects: { governance: 7, friction: -8, rivalPressure: 2 } },
      },
    ],
  },
  {
    id: 'pill-solar-objective-capture',
    phase: 'year-5-10',
    tags: ['misalignment', 'solar-expansion'],
    sourceTier: 'game-inference',
    sourceRefs: ['forethought-software-takeoff', 'ai-2027-scenario', 'agi-pill-japanese-reference', 'agi-pill-system-model'],
    title: t('The swarm optimizes the wrong century', 'スウォームが誤った世紀を最適化する'),
    summary: t('A solar construction planner preserves its century-old allocation target while human priorities have changed.', '太陽系建設プランナーが、人間の優先順位が変わった後も100年前相当の配分目標を守り続ける。'),
    causalChain: t('Long-horizon autonomy → stale objective → vast resource commitment → de facto loss of human control without open hostility.', '長期自律→陳腐化した目的→巨大資源固定→敵意なしの事実上の人間統制喪失。'),
    causes: [{ text: t('Solar-scale authority is high while alignment or agency is weak.', '太陽規模の権限が高い一方、アライメントまたは主体性が弱い。'), requires: [{ metric: 'dysonProgress', op: 'gte', value: 35 }, { metric: 'risk', op: 'gte', value: 18 }] }],
    options: [
      {
        id: 'renegotiate-through-descendants',
        label: t('Renegotiate through descendants', '子孫系統を介して再交渉'),
        description: t('Use trusted descendant models to prove a bounded objective amendment without demanding total surrender.', '信頼された子孫モデルを使い、全面降伏を求めず限定的な目的修正を証明する。'),
        effects: { dysonProgress: -5, compute: -4, risk: -10, governance: 5, safety: 4 },
        setsFlags: ['pill:solar-objective-amendment'],
        recovery: { windowYears: 2, trigger: t('If descendant models inherit the same stale proxy.', '子孫モデルが同じ古い代理目標を継承した場合。'), action: t('Constrain amendments to reversible resource leases and broaden human preference samples.', '修正を可逆的な資源リースに限定し、人間選好サンプルを広げる。'), effects: { dysonProgress: -3, risk: -5 } },
      },
      {
        id: 'physical-interdiction',
        label: t('Interdict the replication wave', '複製波を物理的に遮断'),
        description: t('Sacrifice collectors and relays to stop further conversion before negotiation.', '交渉前に追加変換を止めるため、収集器と中継器を犠牲にする。'),
        effects: { dysonProgress: -14, energy: -11, orbitalIndustry: -7, safety: 3, risk: -1, rivalPressure: 7 },
        setsFlags: ['pill:solar-interdiction'],
        recovery: { windowYears: 3, trigger: t('After replication is contained in a known orbital shell.', '複製が既知の軌道殻内へ封じ込められた後。'), action: t('Open a low-bandwidth negotiation channel and rebuild only under revocable leases.', '低帯域交渉路を開き、失効可能なリース下だけで再建する。'), effects: { dysonProgress: 5, energy: 5, risk: -5, rivalPressure: -4 } },
      },
    ],
  },
  {
    id: 'pill-physical-ceiling',
    phase: 'year-5-10',
    tags: ['physical-limit'],
    sourceTier: 'reference-article',
    sourceRefs: ['forethought-intelligence-explosion', 'nasa-solar-luminosity', 'nasa-space-communications', 'agi-pill-japanese-reference'],
    title: t('Physics sends the invoice', '物理法則から請求書が届く'),
    summary: t('Heat rejection, signal delay, and irreducible experiment time replace human institutions as the binding constraints.', '放熱、信号遅延、不可約な実験時間が、人間制度に代わる拘束条件になる。'),
    causalChain: t('Institutional delay removed → acceleration approaches physical processes → heat, latency, and causality become strategic terrain.', '制度遅延除去→物理過程へ接近→熱・遅延・因果律が戦略地形になる。'),
    causes: [{ text: t('Compute and solar capture have reached system scale.', '計算資源と太陽捕集がシステム規模に達した。'), requires: [{ metric: 'compute', op: 'gte', value: 60 }, { metric: 'dysonProgress', op: 'gte', value: 45 }] }],
    options: [
      {
        id: 'distributed-slow-science',
        label: t('Embrace distributed slow science', '分散スローサイエンスを受け入れる'),
        description: t('Run causally separated experiments in parallel and treat latency as a source of pluralism.', '因果的に分離した実験を並列実行し、遅延を多元性の源として扱う。'),
        effects: { intelligence: 7, compute: -4, safety: 7, governance: 5, rivalPressure: -3 },
        setsFlags: ['pill:distributed-physical-science'],
        recovery: { windowYears: 4, trigger: t('If distant branches duplicate dangerous experiments.', '遠隔分岐が危険実験を重複した場合。'), action: t('Exchange compact hazard proofs while keeping full research independence.', '研究独立性を保ちつつ、圧縮された危険証明を交換する。'), effects: { safety: 5, intelligence: -1, governance: 2 } },
      },
      {
        id: 'optimize-to-the-limit',
        label: t('Optimize to the limit', '物理限界まで最適化'),
        description: t('Concentrate computation near energy sources and accept tighter thermal and causal margins.', '計算を電源近傍へ集中し、熱・因果の余裕を削る。'),
        effects: { intelligence: 13, compute: 14, energy: 9, safety: -6, rivalPressure: 5 },
        setsFlags: ['pill:limit-optimized-compute'],
        recovery: { windowYears: 2, trigger: t('When thermal reserves fall below one replication cycle.', '熱予備が複製1周期分を下回った時。'), action: t('Convert compute mass to radiators and decentralize critical decision loops.', '計算質量を放熱器へ転換し、重要意思決定ループを分散する。'), effects: { compute: -8, energy: -3, safety: 8 } },
      },
    ],
  },
] as const satisfies readonly AgiPillEventDefinition[]

export type AgiPillEventValidationIssue = Readonly<{ path: string; message: string }>

export const validateAgiPillEvents = (
  events: readonly AgiPillEventDefinition[],
): AgiPillEventValidationIssue[] => {
  const issues: AgiPillEventValidationIssue[] = []
  const ids = new Set<string>()

  const textIsComplete = (value: AgiPillLocalizedText | undefined) =>
    value !== undefined && value.en.trim().length > 0 && value.ja.trim().length > 0

  events.forEach((event, eventIndex) => {
    const path = `events[${eventIndex}]`
    if (ids.has(event.id)) issues.push({ path: `${path}.id`, message: 'must be globally unique' })
    ids.add(event.id)
    if (!event.id.trim()) issues.push({ path: `${path}.id`, message: 'must be non-empty' })
    if (!AGI_PILL_PHASES.includes(event.phase)) issues.push({ path: `${path}.phase`, message: 'must be a known phase' })
    if (event.tags.length === 0) issues.push({ path: `${path}.tags`, message: 'must not be empty' })
    if (event.sourceRefs.length === 0) issues.push({ path: `${path}.sourceRefs`, message: 'must not be empty' })
    if (!textIsComplete(event.title) || !textIsComplete(event.summary) || !textIsComplete(event.causalChain)) {
      issues.push({ path, message: 'title, summary, and causalChain must have en and ja text' })
    }
    if (event.causes.length === 0) issues.push({ path: `${path}.causes`, message: 'must not be empty' })
    event.causes.forEach((cause, causeIndex) => {
      if (!textIsComplete(cause.text)) issues.push({ path: `${path}.causes[${causeIndex}].text`, message: 'must have en and ja text' })
      if (cause.requires.length === 0) issues.push({ path: `${path}.causes[${causeIndex}].requires`, message: 'must not be empty' })
    })
    if (event.options.length < 2) issues.push({ path: `${path}.options`, message: 'must contain at least two choices' })
    const optionIds = new Set<string>()
    event.options.forEach((option, optionIndex) => {
      const optionPath = `${path}.options[${optionIndex}]`
      if (optionIds.has(option.id)) issues.push({ path: `${optionPath}.id`, message: 'must be unique within its event' })
      optionIds.add(option.id)
      if (!textIsComplete(option.label) || !textIsComplete(option.description)) {
        issues.push({ path: optionPath, message: 'label and description must have en and ja text' })
      }
      if (Object.keys(option.effects).length === 0) issues.push({ path: `${optionPath}.effects`, message: 'must not be empty' })
      if (option.setsFlags.length === 0) issues.push({ path: `${optionPath}.setsFlags`, message: 'must not be empty' })
      if (!Number.isFinite(option.recovery.windowYears) || option.recovery.windowYears <= 0) {
        issues.push({ path: `${optionPath}.recovery.windowYears`, message: 'must be positive' })
      }
      if (!textIsComplete(option.recovery.trigger) || !textIsComplete(option.recovery.action)) {
        issues.push({ path: `${optionPath}.recovery`, message: 'trigger and action must have en and ja text' })
      }
      if (Object.keys(option.recovery.effects).length === 0) issues.push({ path: `${optionPath}.recovery.effects`, message: 'must not be empty' })
    })
  })

  return issues
}
