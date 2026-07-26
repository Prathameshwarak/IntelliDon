export const CURRENT_TERMS_VERSION = 'v1.0'
export const CURRENT_PRIVACY_VERSION = 'v1.0'

export type DocumentType = 'terms_and_conditions' | 'privacy_policy'

export interface ConsentRecord {
  id?: string
  user_id?: string
  mandal_id?: string
  document_type: DocumentType
  document_version: string
  accepted_at?: string
  ip_address?: string
  user_agent?: string
}
