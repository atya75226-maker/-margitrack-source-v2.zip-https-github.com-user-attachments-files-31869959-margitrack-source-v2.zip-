/**
 * Point d'entrée unique du stockage. L'application n'importe jamais le client
 * Supabase directement : elle passe par `repo` et par les utilitaires d'images.
 */
export * as repo from './supabase.adapter'
export { notifyChange } from './supabase.adapter'
export { uploadImage, removeImage, publicImagePath, toDataUrl } from './assets'
