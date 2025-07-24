import { requireEnv } from '../constants'

export const RPC_URL = requireEnv('NEXT_PUBLIC_0G_RPC_URL')
export const FINE_TUNING_SERVING = requireEnv('NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS')
export const FINE_TUNE_PROVIDER = requireEnv('NEXT_PUBLIC_FINE_TUNE_PROVIDER')
export const PK = requireEnv('OG_COMPUTE_PRIVATE_KEY')
