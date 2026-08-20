import env from '#start/env'
import type { PayfipClient } from '#services/payfip/types'
import FakePayfipClient from '#services/payfip/fake_client'
import RealPayfipClient from '#services/payfip/real_client'

const payfipClient: PayfipClient =
  env.get('PAYFIP_MODE') === 'real' ? new RealPayfipClient() : new FakePayfipClient()

export default payfipClient
export type {
  PayfipClient,
  SaisiePaiementParams,
  SaisiePaiementResult,
  RecupererDetailResult,
  PayfipResolutionStatus,
} from '#services/payfip/types'
