"use strict";
class Main {
  constructor() {
    this.useLocal = // Use local storage to get playlists
      new URLSearchParams(window.location.search).get("useLocal") === "true";
    this.playlists = this.useLocal
      ? JSON.parse(localStorage.getItem("playlists")) || []
      : []; // User's playlists
    this.selectPlaylists = []; // User's selected source playlists
    this.baseUrl =
      window.location.hostname === "localhost" || "127.0.0.1"
        ? "http://localhost:5001/spotify-should-sync-merged-pla/us-central1/app"
        : "https://us-central1-spotify-should-sync-merged-pla.cloudfunctions.net/app";
    document.addEventListener("DOMContentLoaded", () => {
      console.log(this);
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
      this.signOutButton = document.getElementById("navbar-sign-out-button");
      this.nameContainer = document.getElementById("name-container");
      this.uidContainer = document.getElementById("uid-container");
      this.navbarProfileWrapper = document.getElementById(
        "navbar-profile-wrapper"
      );
      this.profilePic = document.getElementById("navbar-profile-pic");
      this.loadingCard = document.getElementById("loading-card");
      this.signedOutCard = document.getElementById("signed-out-card");
      this.signedInCard = document.getElementById("signed-in-card");
      this.sourcePlaylistList = document.getElementById("source-playlist-list");
      this.sourcePlaylistTable = document.getElementById(
        "source-playlist-table"
      );
      // Event binding
      this.signInButton.addEventListener(
        "click",
        this.onSignInButtonClick.bind(this)
      );
      this.signOutButton.addEventListener(
        "click",
        this.onSignOutButtonClick.bind(this)
      );
    });
  }

  async onAuthStateChanged(user) {
    console.log(this);
    // Skip token refresh.
    if (user && user.uid === this.lastUid) return;
    this.loadingCard.style.display = "none";
    if (user) {
      this.lastUid = user.uid;
      // this.nameContainer.innerText = user.displayName;
      // this.uidContainer.innerText = user.uid;
      this.profilePic.src = user.photoURL;
      this.navbarProfileWrapper.style.display = "block";
      this.signedOutCard.style.display = "none";
      this.signedInCard.style.display = "block";
      await this.fetchPlaylists();
    } else {
      this.lastUid = null;
      this.signedOutCard.style.display = "block";
      this.signedInCard.style.display = "none";
    }
  }

  async fetchPlaylists() {
    // If using local and no playlists then try and fetch
    // If not using local then fetch
    if (!this.useLocal || (this.useLocal && !this.playlists.length)) {
      const token = await firebase.auth().currentUser.getIdToken();
      const response = await fetch(`${this.baseUrl}/spotify/playlists`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      this.playlists = await response.json();
      if (this.useLocal)
        localStorage.setItem("playlists", JSON.stringify(this.playlists));
    }
    this.playlists
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
        playlistItem.setAttribute("id", playlist.id);
        const playlistImg = document.createElement("img");
        playlistImg.classList.add("playlist-avatar");
        playlistImg.src = playlist.images[0].url;
        const playlistName = document.createElement("span");
        playlistName.classList.add("playlist-name");
        playlistName.innerText = playlist.name;
        playlistItem.append(playlistImg, playlistName);
        playlistItem.addEventListener("click", () => {
          playlistItem.classList.toggle("active");
          if (playlistItem.classList.contains("active"))
            this.onSourcePlaylistSelect(playlistItem.id, true);
          else this.onSourcePlaylistSelect(playlistItem.id, false);
        });
        this.sourcePlaylistList.append(playlistItem);
      });
  }

  onSignInButtonClick() {
    // Open the Auth flow as a popup.
    window.open(
      `${this.baseUrl}/auth/spotify/redirect`,
      "firebaseAuth",
      "height=auto,width=auto"
    );
  }
  onSignOutButtonClick() {
    firebase.auth().signOut();
    this.navbarProfileWrapper.style.display = "none";
    console.log(this.profilePic);
    this.profilePic.src = "";
  }
  onSourcePlaylistSelect(id, active) {
    active
      ? this.selectPlaylists.push(id)
      : (this.selectPlaylists = this.selectPlaylists.filter(
          (playlistId) => playlistId !== id
        ));
  }
}

new Main();
