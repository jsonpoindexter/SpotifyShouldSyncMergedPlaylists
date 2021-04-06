"use strict";

function Main() {
  const baseUrl =
    window.location.hostname === "localhost" || "127.0.0.1"
      ? "http://localhost:5001/spotify-should-sync-merged-pla/us-central1/app"
      : "https://us-central1-spotify-should-sync-merged-pla.cloudfunctions.net/app";
  console.log(baseUrl);
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
      this.sourcePlaylistList = document.getElementById("source-playlist-list");
      this.sourcePlaylistTable = document.getElementById(
        "source-playlist-table"
      );
      // Event binding
      this.signInButton.addEventListener("click", this.onSignInButtonClick);
      this.signOutButton.addEventListener("click", this.onSignOutButtonClick);
    }.bind(this)
  );

  Main.prototype.onAuthStateChanged = async function (user) {
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
      await this.fetchPlaylists();
    } else {
      this.lastUid = null;
      this.signedOutCard.style.display = "block";
      this.signedInCard.style.display = "none";
    }
  };

  Main.prototype.fetchPlaylists = async function () {
    const token = await firebase.auth().currentUser.getIdToken();
    const response = await fetch(`${baseUrl}/spotify/playlists`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const playlists = await response.json();
    playlists
      .sort((a, b) => {
        if (a.name < b.name) {
          return -1;
        }
        if (a.name > b.name) {
          return 1;
        }
        return 0;
      })
      .forEach((playlist) => {
        // Populate playlist unordered list
        const playlistItem = document.createElement("li");
        playlistItem.setAttribute("class", "list-group-item");
        const playlistImg = document.createElement("img");
        playlistImg.classList.add("playlist-avatar");
        playlistImg.src = playlist.images[0].url;
        const playlistName = document.createElement("span");
        playlistName.classList.add("playlist-name");
        playlistName.innerText = playlist.name;
        playlistItem.append(playlistImg, playlistName);
        playlistItem.addEventListener("click", () => {
          playlistItem.classList.toggle("active");
        });

        this.sourcePlaylistList.append(playlistItem);
      });
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
