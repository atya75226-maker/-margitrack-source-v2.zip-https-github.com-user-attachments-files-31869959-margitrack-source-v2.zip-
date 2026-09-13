/**
 * Accès aux données, côté Supabase.
 *
 * Toute l'application passe par `repo` : aucun composant n'écrit de requête SQL
 * ni n'appelle directement le client Supabase. Les règles d'accès, elles, ne sont
 * pas ici mais dans la base (RLS et fonctions vault_*) : un client modifié ne peut
 * donc pas contourner ce fichier.
 */

import { supabase, readableError } from '../supabaseClient'

/* ------------------------------------------------------ notifications locales */

const CHANGE_EVENT = 'kartaa:changed'

export function notifyChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export function subscribe(listener) {
  const handler = () => listener()
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

function fail(error, fallback) {
  throw new Error(readableError(error, fallback))
}

/* --------------------------------------------------------------- conversions */

const toProfile = (row) => row && {
  id: row.id,
  firstName: row.first_name || '',
  lastName: row.last_name || '',
  email: row.email || '',
  phone: row.phone || '',
  plan: row.plan || 'free',
  createdAt: row.created_at,
}

const toCard = (row) => row && {
  id: row.id,
  userId: row.user_id,
  slug: row.slug,
  template: row.template,
  theme: row.theme || {},
  profile: row.profile || {},
  socials: row.socials || [],
  about: row.about || '',
  activities: row.activities || [],
  companies: row.companies || [],
  services: row.services || [],
  gallery: row.gallery || [],
  customDomain: row.custom_domain || null,
  scans: row.scans || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}

/** N'envoie que les colonnes réellement modifiables. */
function fromCard(patch) {
  const row = {}
  const direct = ['slug', 'template', 'theme', 'profile', 'socials', 'about', 'activities', 'companies', 'services', 'gallery']
  direct.forEach((key) => {
    if (patch[key] !== undefined) row[key] = patch[key]
  })
  if (patch.customDomain !== undefined) row.custom_domain = patch.customDomain
  return row
}

const toVaultFile = (row) => ({
  id: row.id,
  vaultId: row.vault_id,
  name: row.name,
  mime: row.mime,
  category: row.category,
  size: Number(row.size) || 0,
  folderId: row.folder_id,
  storagePath: row.storage_path,
  iv: row.iv,
  addedAt: row.added_at,
})

const toLogEntry = (row) => ({
  at: row.created_at,
  action: row.action,
  result: row.result,
  method: row.method,
  file: row.detail,
})

const toVault = (row, files = [], accessLog = []) => row && {
  id: row.id,
  userId: row.user_id,
  name: row.name,
  protection: row.protection,
  hasBiometric: row.protection === 'password+biometric',
  folders: row.folders || [],
  failedAttempts: row.failed_attempts || 0,
  lockedUntil: row.locked_until,
  lastOpenedAt: row.last_opened_at,
  recoveryIssuedAt: row.recovery_issued_at,
  recoveryUsedAt: row.recovery_used_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  files,
  accessLog,
}

/* ------------------------------------------------------------------ comptes */

export const users = {
  async get(id) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    if (error) fail(error, 'Profil introuvable.')
    return toProfile(data)
  },

  async update(id, patch) {
    const row = {}
    if (patch.firstName !== undefined) row.first_name = patch.firstName
    if (patch.lastName !== undefined) row.last_name = patch.lastName
    if (patch.email !== undefined) row.email = patch.email
    if (patch.phone !== undefined) row.phone = patch.phone
    if (patch.plan !== undefined) row.plan = patch.plan

    const { data, error } = await supabase.from('profiles').update(row).eq('id', id).select().single()
    if (error) fail(error, 'Mise à jour impossible.')
    notifyChange()
    return toProfile(data)
  },
}

/* ------------------------------------------------------------------- cartes */

export const cards = {
  async listByUser(userId) {
    const { data, error } = await supabase
      .from('cards').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    if (error) fail(error, 'Impossible de charger vos cartes.')
    return data.map(toCard)
  },

  async get(id) {
    const { data, error } = await supabase.from('cards').select('*').eq('id', id).maybeSingle()
    if (error) fail(error, 'Carte introuvable.')
    return toCard(data)
  },

  /** Lecture publique du mini-site : passe par une fonction qui ne livre qu'une carte. */
  async getBySlug(slug) {
    const { data, error } = await supabase.rpc('card_by_slug', { p_slug: slug })
    if (error) fail(error, 'Page introuvable.')
    return data || null
  },

  async slugAvailable(slug, exceptId = null) {
    const { data, error } = await supabase.rpc('slug_available', { p_slug: slug, p_except: exceptId })
    if (error) return true
    return data !== false
  },

  async create(userId, payload) {
    const { data, error } = await supabase
      .from('cards').insert({ ...fromCard(payload), user_id: userId }).select().single()
    if (error) fail(error, "La carte n'a pas pu être créée.")
    notifyChange()
    return toCard(data)
  },

  async update(id, patch) {
    const { data, error } = await supabase.from('cards').update(fromCard(patch)).eq('id', id).select().single()
    if (error) fail(error, "La carte n'a pas pu être enregistrée.")
    notifyChange()
    return toCard(data)
  },

  async remove(id) {
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) fail(error, 'Suppression impossible.')
    notifyChange()
  },

  /** Comptabilise une visite de la page publique. Silencieux en cas d'échec. */
  async registerScan(slug, source = 'qr') {
    await supabase.rpc('register_card_scan', { p_slug: slug, p_source: source })
  },

  /** Historique des scans pour les statistiques. */
  async scanHistory(days = 14) {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const { data, error } = await supabase
      .from('card_scans').select('card_id, scanned_at')
      .gte('scanned_at', since.toISOString())
      .order('scanned_at', { ascending: true })
    if (error) return []
    return data.map((row) => ({ cardId: row.card_id, at: row.scanned_at }))
  },
}

/* ------------------------------------------------------------------ coffres */

async function filesOf(vaultIds) {
  if (!vaultIds.length) return new Map()
  const { data, error } = await supabase
    .from('vault_files').select('*').in('vault_id', vaultIds).order('added_at', { ascending: false })
  if (error) return new Map()
  const grouped = new Map()
  data.forEach((row) => {
    const list = grouped.get(row.vault_id) || []
    list.push(toVaultFile(row))
    grouped.set(row.vault_id, list)
  })
  return grouped
}

export const vaults = {
  async listByUser(userId) {
    const { data, error } = await supabase
      .from('vaults').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    if (error) fail(error, 'Impossible de charger vos coffres.')
    const grouped = await filesOf(data.map((row) => row.id))
    return data.map((row) => toVault(row, grouped.get(row.id) || []))
  },

  async get(id) {
    const { data, error } = await supabase.from('vaults').select('*').eq('id', id).maybeSingle()
    if (error) fail(error, 'Coffre introuvable.')
    if (!data) return null

    const [{ data: files }, { data: log }] = await Promise.all([
      supabase.from('vault_files').select('*').eq('vault_id', id).order('added_at', { ascending: false }),
      supabase.from('vault_access_log').select('*').eq('vault_id', id).order('created_at', { ascending: false }).limit(50),
    ])
    return toVault(data, (files || []).map(toVaultFile), (log || []).map(toLogEntry))
  },

  /** Seuls le nom et les dossiers sont modifiables directement : les secrets passent par les RPC. */
  async update(id, patch) {
    const row = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.folders !== undefined) row.folders = patch.folders
    if (Object.keys(row).length) {
      const { error } = await supabase.from('vaults').update(row).eq('id', id)
      if (error) fail(error, 'Mise à jour impossible.')
    }
    notifyChange()
    return vaults.get(id)
  },

  async remove(id) {
    const { data: files } = await supabase.from('vault_files').select('storage_path').eq('vault_id', id)
    if (files?.length) {
      await supabase.storage.from('vault-files').remove(files.map((file) => file.storage_path))
    }
    const { error } = await supabase.from('vaults').delete().eq('id', id)
    if (error) fail(error, 'Suppression impossible.')
    notifyChange()
  },

  async appendLog(id, entry) {
    await supabase.rpc('vault_log', {
      p_vault_id: id,
      p_action: entry.action,
      p_result: entry.result || 'ok',
      p_method: entry.method || null,
      p_detail: entry.file || entry.detail || null,
    })
  },
}
