/**
 * Adaptateur de persistance « prototype » : tout reste sur l'appareil.
 *
 * L'API est asynchrone et volontairement identique à ce qu'exposerait un backend
 * (Supabase, Firebase, API maison) : remplacer ce fichier par un adaptateur réseau
 * suffit à brancher l'application sur un vrai serveur — voir README.
 */

import { hashPassword, verifyPassword, randomId } from '../crypto'
import { blobs } from './db'

const KEY = 'kartaa.db.v1'
const SESSION_KEY = 'kartaa.session.v1'

const EMPTY = { users: [], cards: [], vaults: [] }

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY)
    return { ...structuredClone(EMPTY), ...JSON.parse(raw) }
  } catch {
    return structuredClone(EMPTY)
  }
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('kartaa:changed'))
  return state
}

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)))
const now = () => new Date().toISOString()

/* ------------------------------------------------------------------ comptes */

export const users = {
  async list() {
    return read().users.map(({ password, ...rest }) => rest)
  },
  async findByEmail(email) {
    const target = (email || '').trim().toLowerCase()
    return read().users.find((user) => user.email === target) || null
  },
  async get(id) {
    const user = read().users.find((item) => item.id === id)
    if (!user) return null
    const { password, ...rest } = user
    return rest
  },
  async create({ firstName, lastName, email, phone, password }) {
    const state = read()
    const normalized = (email || '').trim().toLowerCase()
    if (state.users.some((user) => user.email === normalized)) {
      throw new Error('Un compte existe déjà avec cette adresse e-mail.')
    }
    const user = {
      id: randomId('usr'),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalized,
      phone: (phone || '').trim(),
      plan: 'free',
      createdAt: now(),
      password: await hashPassword(password),
    }
    state.users.push(user)
    write(state)
    const { password: _, ...safe } = user
    return safe
  },
  async authenticate(email, password) {
    const state = read()
    const normalized = (email || '').trim().toLowerCase()
    const user = state.users.find((item) => item.email === normalized)
    if (!user) throw new Error("Aucun compte ne correspond à cette adresse e-mail.")
    const valid = await verifyPassword(password, user.password)
    if (!valid) throw new Error('Mot de passe incorrect.')
    const { password: _, ...safe } = user
    return safe
  },
  async update(id, patch) {
    const state = read()
    const index = state.users.findIndex((user) => user.id === id)
    if (index < 0) throw new Error('Compte introuvable.')
    state.users[index] = { ...state.users[index], ...patch, id }
    write(state)
    const { password: _, ...safe } = state.users[index]
    return safe
  },
  async changePassword(id, password) {
    const state = read()
    const index = state.users.findIndex((user) => user.id === id)
    if (index < 0) throw new Error('Compte introuvable.')
    state.users[index].password = await hashPassword(password)
    write(state)
    return true
  },
}

/* ------------------------------------------------------------------ session */

export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY))?.userId || null
    } catch {
      return null
    }
  },
  set(userId) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, at: now() }))
  },
  clear() {
    localStorage.removeItem(SESSION_KEY)
  },
}

/* ------------------------------------------------------------------- cartes */

export const cards = {
  async listByUser(userId) {
    return clone(read().cards.filter((card) => card.userId === userId))
  },
  async get(id) {
    return clone(read().cards.find((card) => card.id === id) || null)
  },
  async getBySlug(slug) {
    const target = (slug || '').toLowerCase()
    return clone(read().cards.find((card) => card.slug === target) || null)
  },
  async slugAvailable(slug, exceptId = null) {
    const target = (slug || '').toLowerCase()
    return !read().cards.some((card) => card.slug === target && card.id !== exceptId)
  },
  async create(userId, data) {
    const state = read()
    const card = {
      id: randomId('crd'),
      userId,
      createdAt: now(),
      updatedAt: now(),
      scans: 0,
      scanLog: [],
      customDomain: null,
      ...data,
    }
    state.cards.push(card)
    write(state)
    return clone(card)
  },
  async update(id, patch) {
    const state = read()
    const index = state.cards.findIndex((card) => card.id === id)
    if (index < 0) throw new Error('Carte introuvable.')
    state.cards[index] = { ...state.cards[index], ...patch, id, updatedAt: now() }
    write(state)
    return clone(state.cards[index])
  },
  async remove(id) {
    const state = read()
    const card = state.cards.find((item) => item.id === id)
    if (card) {
      await Promise.all(
        [card.profile?.photoId, ...(card.companies || []).map((c) => c.logoId), ...(card.gallery || []).map((g) => g.blobId)]
          .filter(Boolean)
          .map((blobId) => blobs.remove(blobId)),
      )
    }
    state.cards = state.cards.filter((item) => item.id !== id)
    write(state)
  },
  /** Comptabilise une visite de la page publique (scan du QR Code ou lien direct). */
  async registerScan(id, source = 'qr') {
    const state = read()
    const index = state.cards.findIndex((card) => card.id === id)
    if (index < 0) return null
    const card = state.cards[index]
    card.scans = (card.scans || 0) + 1
    card.scanLog = [...(card.scanLog || []), { at: now(), source }].slice(-500)
    write(state)
    return clone(card)
  },
}

/* ------------------------------------------------------------------ coffres */

export const vaults = {
  async listByUser(userId) {
    return clone(read().vaults.filter((vault) => vault.userId === userId))
  },
  async get(id) {
    return clone(read().vaults.find((vault) => vault.id === id) || null)
  },
  async create(userId, data) {
    const state = read()
    const vault = {
      id: randomId('vlt'),
      userId,
      createdAt: now(),
      updatedAt: now(),
      folders: [],
      files: [],
      accessLog: [],
      failedAttempts: 0,
      lockedUntil: null,
      ...data,
    }
    state.vaults.push(vault)
    write(state)
    return clone(vault)
  },
  async update(id, patch) {
    const state = read()
    const index = state.vaults.findIndex((vault) => vault.id === id)
    if (index < 0) throw new Error('Coffre introuvable.')
    state.vaults[index] = { ...state.vaults[index], ...patch, id, updatedAt: now() }
    write(state)
    return clone(state.vaults[index])
  },
  async remove(id) {
    const state = read()
    const vault = state.vaults.find((item) => item.id === id)
    if (vault) await Promise.all((vault.files || []).map((file) => blobs.remove(file.blobId)))
    state.vaults = state.vaults.filter((item) => item.id !== id)
    write(state)
  },
  /** Journalise un évènement d'accès (déverrouillage, échec, consultation, export). */
  async appendLog(id, entry) {
    const state = read()
    const index = state.vaults.findIndex((vault) => vault.id === id)
    if (index < 0) return null
    const vault = state.vaults[index]
    vault.accessLog = [{ at: now(), ...entry }, ...(vault.accessLog || [])].slice(0, 200)
    write(state)
    return clone(vault)
  },
}

export function subscribe(listener) {
  const handler = () => listener()
  window.addEventListener('kartaa:changed', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('kartaa:changed', handler)
    window.removeEventListener('storage', handler)
  }
}

export async function resetEverything() {
  localStorage.removeItem(KEY)
  localStorage.removeItem(SESSION_KEY)
  await blobs.clear()
  window.dispatchEvent(new CustomEvent('kartaa:changed'))
}
