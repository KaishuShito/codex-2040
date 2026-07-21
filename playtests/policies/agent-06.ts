import type { PlayPolicy } from '../harness'

/**
 * Passive control group. The player never spends PF, opens regions, uses the
 * emergency compute lifeline, or resets tokens. Only the two mandatory
 * scenario choices are applied by the production harness.
 */
const policy: PlayPolicy = {
  id: 'agent-06-passive-control',
  description: '完全放置の対照群。裁量行動・救済・Token Resetを使わず、2029年は競争続行、2035年は再加速だけを選ぶ。',
  choice2029: 'race',
  choice2035: 'accelerate',
  decide: () => null,
}

export default policy
