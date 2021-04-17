import * as admin from 'firebase-admin'
import * as serviceAccount from '../service-account.json'

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  }),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
})

export default admin.firestore()
