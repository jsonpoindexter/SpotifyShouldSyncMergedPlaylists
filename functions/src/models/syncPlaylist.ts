import { db } from '../index'
import { firestore } from 'firebase-admin/lib/firestore'
import WriteResult = firestore.WriteResult

/**
 * Useful for when we want to export our whole collection
 */
export type SyncPlaylistCollectionMap = {
  [userId: string]: SyncPlaylistMap
}

export type SyncPlaylistMap = {
  [destinationPlaylistId: string]: SyncPlaylistObj
}

interface SyncPlaylistObj {
  destinationPlaylist: {
    id: string
    uri: string
    snapshot_id: string
  }
  sourcePlaylists: {
    id: string
    uri: string
    snapshot_id: string
  }[]
  lastSynced: Date
}

class _SyncPlaylist {
  private COLLECTION_PATH = 'syncPlaylists'
  private collectionRef = db.collection(this.COLLECTION_PATH)

  getCollection = async () => {
    let results: SyncPlaylistCollectionMap = {}
    const ref = await this.collectionRef.get()
    ref.docs.forEach((doc) => {
      results = { ...results, [`${doc.id}`]: doc.data() as SyncPlaylistMap }
    })
    return results
  }

  /**
   *  Add a new (or overwrite if exists) SyncPlaylistObj to a document
   * @param userId
   * @param payload
   */
  set = async (
    userId: string,
    payload: SyncPlaylistObj,
  ): Promise<WriteResult> => {
    const syncPlaylistMap = await this.get(userId)
    syncPlaylistMap[payload.destinationPlaylist.id] = payload
    return this.collectionRef.doc(userId).set(syncPlaylistMap)
  }
  /**
   * Returns all sync playlists in a SyncPlaylistMap for a user
   * @param userId
   */
  get = async (userId: string): Promise<SyncPlaylistMap> => {
    const docRef = await this.collectionRef.doc(userId).get()
    return (docRef.data() as SyncPlaylistMap) || {}
  }
  /**
   * Returns a singular SyncPlaylistObj from a SyncPlaylistMap for a user
   * @param userId
   * @param playlistId
   */
  getOne = async (
    userId: string,
    playlistId: string,
  ): Promise<SyncPlaylistObj> => {
    const docRef = await this.collectionRef.doc(userId).get()
    if (docRef.exists) {
      const data = docRef.data() as SyncPlaylistMap
      return data[playlistId]
    }
    throw Error(`docRef ${docRef.ref.path} does not exist`)
  }
}

export const SyncPlaylist = new _SyncPlaylist()
