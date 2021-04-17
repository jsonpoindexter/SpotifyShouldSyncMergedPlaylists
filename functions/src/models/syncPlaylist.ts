import { firestore } from 'firebase-admin/lib/firestore'
import db from '../services/db'
import WriteResult = firestore.WriteResult
import Timestamp = firestore.Timestamp

/**
 * Useful for when we want to export our whole collection
 */
export type SyncPlaylistCollectionMap = {
  [userId: string]: SyncPlaylistMap
}

export type SyncPlaylistMap = {
  [destinationPlaylistId: string]: SyncPlaylistObj
}

interface PlaylistObj {
  id: string
  uri: string
  snapshot_id: string
}
interface SyncPlaylistObj {
  destinationPlaylist: PlaylistObj
  sourcePlaylists: PlaylistObj[]
  lastSynced: Timestamp
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

  /**
   * Update a snapshot id of user's playlistObj sourcePlaylist or destinationPlaylist
   * If its a sourceplaylist we need to find the specific playlist
   * @param {string} userId
   * @param {string} destinationPlaylistId
   * @param {string} snapshotId
   * @param {string} sourcePlaylistId
   * @returns {Promise<void>}
   */
  updateSnapshotId = async (
    userId: string,
    destinationPlaylistId: string,
    snapshotId: string,
    sourcePlaylistId?: string,
  ) => {
    const docRef = this.collectionRef.doc(userId)
    const docSnapshot = await docRef.get()
    if (docSnapshot.exists) {
      const syncPlaylistObj = (docSnapshot.data() as SyncPlaylistMap)[
        destinationPlaylistId
      ]
      if (sourcePlaylistId) {
        const sourcePlaylist = syncPlaylistObj.sourcePlaylists.find(
          (sourcePlaylist) => sourcePlaylist.id === sourcePlaylistId,
        )
        if (!sourcePlaylist)
          throw Error(
            `sourcePlaylistId ${sourcePlaylistId} does not exist on ${destinationPlaylistId}`,
          )
        sourcePlaylist.snapshot_id = snapshotId
      } else {
        syncPlaylistObj.destinationPlaylist.snapshot_id = snapshotId
      }
      syncPlaylistObj.lastSynced = Timestamp.now()
      await docRef.update(destinationPlaylistId, syncPlaylistObj)
    } else {
      throw Error(`docSnapshot ${docSnapshot.ref.path} does not exist`)
    }
  }
}

export const SyncPlaylist = new _SyncPlaylist()
