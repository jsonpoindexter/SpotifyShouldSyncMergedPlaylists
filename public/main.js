"use strict";

function Main() {
  const baseUrl =
    window.location.hostname === "localhost"
      ? "http://localhost:5001/spotify-should-sync-merged-pla/us-central1/app"
      : "https://us-central1-spotify-should-sync-merged-pla.cloudfunctions.net/app";
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      // Handle customToken returned from auth window closing
      window.onmessage = function (e) {
        if (e.data) {
          firebase.auth().signInWithCustomToken(e.data);
        } else {
          console.log(
            "nothing was returned from window: expected custom token"
          );
        }
      };
      // Load firebase
      firebase.auth().onAuthStateChanged(this.onAuthStateChanged.bind(this));

      // Handlers
      this.signInButton = document.getElementById("sign-in-button");
      this.signOutButton = document.getElementById("sign-out-button");
      this.nameContainer = document.getElementById("name-container");
      this.uidContainer = document.getElementById("uid-container");
      this.profilePic = document.getElementById("profile-pic");
      this.loadingCard = document.getElementById("loading-card");
      this.signedOutCard = document.getElementById("signed-out-card");
      this.signedInCard = document.getElementById("signed-in-card");
      // Event binding
      this.signInButton.addEventListener("click", this.onSignInButtonClick);
      this.signOutButton.addEventListener("click", this.onSignOutButtonClick);
    }.bind(this)
  );

  Main.prototype.onAuthStateChanged = function (user) {
    // Skip token refresh.
    if (user && user.uid === this.lastUid) return;
    this.loadingCard.style.display = "none";
    if (user) {
      this.lastUid = user.uid;
      this.nameContainer.innerText = user.displayName;
      this.uidContainer.innerText = user.uid;
      this.profilePic.src = user.photoURL;
      this.signedOutCard.style.display = "none";
      this.signedInCard.style.display = "block";
      this.spotifyTokenRef = firebase
        .database()
        .ref("/spotifyAccessToken/" + user.uid);
    } else {
      this.lastUid = null;
      this.signedOutCard.style.display = "block";
      this.signedInCard.style.display = "none";
    }
  };
  Main.prototype.onSignInButtonClick = function () {
    // Open the Auth flow as a popup.
    window.open(
      `${baseUrl}/auth/spotify/redirect`,
      "firebaseAuth",
      "height=315,width=400"
    );
  };
  Main.prototype.onSignOutButtonClick = function () {
    firebase.auth().signOut();
  };
}
new Main();
