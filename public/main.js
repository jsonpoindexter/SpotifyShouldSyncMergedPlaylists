"use strict";

const PLAYLIST_NAME_MAX_LENGTH = 100; // Max playlist name length defined by Spotify
const PLAYLIST_DESCRIPTION_MAX_LENGTH = 300; // Max playlist description length defined by Spotify
const CREATING_PLAYLIST_MIN_MS = 2000; // Min amount of time before going to success or failure modal status

class Main {
  constructor() {
    this.useLocal = // Use local storage to get playlists
      new URLSearchParams(window.location.search).get("useLocal") === "true";
    this.playlists = this.useLocal
      ? JSON.parse(localStorage.getItem("playlists")) || []
      : []; // User's playlists
    this.selectPlaylists = []; // User's selected source playlists
    this.baseUrl =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? "http://localhost:5001/spotify-should-sync-merged-pla/us-central1/app"
        : "https://us-central1-spotify-should-sync-merged-pla.cloudfunctions.net/app";
    document.addEventListener("DOMContentLoaded", () => {
      // Handle customToken returned from auth window closing
      window.onmessage = this.handleAuthWindowClose;
      // Load firebase
      firebase.auth().onAuthStateChanged(this.onAuthStateChanged.bind(this));

      // Handlers
      this.signInButton = document.getElementById("sign-in-button");
      this.signOutButton = document.getElementById("navbar-sign-out-button");
      this.destinationPlaylistForm = document.getElementById(
        "destination-playlist-form"
      );
      this.destinationPlaylistName = document.getElementById(
        "destination-playlist-name"
      );
      this.destinationPlaylistName.maxLength = PLAYLIST_NAME_MAX_LENGTH;
      this.destinationPlaylistNameCounter = document.getElementById(
        "destination-playlist-name-counter"
      );
      this.updateDestinationPlaylistNameCounter(0);
      this.destinationPlaylisDescription = document.getElementById(
        "destination-playlist-description"
      );
      this.destinationPlaylisDescription.maxLength = PLAYLIST_DESCRIPTION_MAX_LENGTH;
      this.destinationPlaylistDescCounter = document.getElementById(
        "destination-playlist-description-counter"
      );
      this.updateDestinationPlaylistDescCounter(0);
      this.navbarProfileWrapper = document.getElementById(
        "navbar-profile-wrapper"
      );
      this.profilePic = document.getElementById("navbar-profile-pic");
      this.loadingCard = document.getElementById("loading-card");
      this.signedOutCard = document.getElementById("signed-out-card");
      this.signedInCard = document.getElementById("signed-in-card");
      this.sourcePlaylistList = document.getElementById("source-playlist-list");
      // Event binding
      this.signInButton.addEventListener(
        "click",
        this.onSignInButtonClick.bind(this)
      );
      this.signOutButton.addEventListener(
        "click",
        this.onSignOutButtonClick.bind(this)
      );
      this.destinationPlaylistName.addEventListener("input", (event) =>
        this.updateDestinationPlaylistNameCounter(event.target.value.length)
      );
      //
      this.destinationPlaylistForm.addEventListener(
        "submit",
        this.onCreatePlaylist.bind(this),
        false
      );
    });
  }

  handleAuthWindowClose(event) {
    if (event.data) {
      firebase.auth().signInWithCustomToken(event.data);
    } else {
      console.log(
        "nothing was returned from auth window: expected custom token"
      );
    }
  }
  async onCreatePlaylist(event) {
    event.preventDefault();
    this.destinationPlaylistForm.classList.add("was-validated");
    if (!this.destinationPlaylistForm.checkValidity()) {
      event.stopPropagation();
    } else {
      // Disable exiting modal until the playlist api call responds
      const creatingPlaylistModal = new bootstrap.Modal(
        document.getElementById("creating-playlist-modal"),
        { backdrop: "static", keyboard: false }
      );
      // Reset validation on modal close
      document
        .getElementById("creating-playlist-modal")
        .addEventListener("hidden.bs.modal", () => {
          // Reset form validation
          this.destinationPlaylistForm.classList.remove("was-validated");
          // Remove white status text from modal
          document
            .getElementById("creating-playlist-modal-status")
            .classList.remove("text-white");
        });
      // Show the spinner if its hidden
      document
        .getElementById("creating-playlist-modal-spinner")
        .classList.remove("visually-hidden");
      // Set initial modal status text
      document.getElementById("creating-playlist-modal-status").innerHTML =
        "Creating Playlist...";
      // Remove modal content background anger if it exists
      document
        .getElementById("creating-playlist-modal-content")
        .classList.remove("bg-danger");
      // Hide the X close button by default
      document
        .getElementById("creating-playlist-modal-close")
        .classList.add("visually-hidden");
      creatingPlaylistModal.show();

      try {
        const token = await firebase.auth().currentUser.getIdToken();
        const startDate = new Date();
        const response = await fetch(
          `${this.baseUrl}/spotify/playlists/combine`,
          {
            body: JSON.stringify({
              playlistIds: this.selectPlaylists,
              name: this.destinationPlaylistName.value,
              description: this.destinationPlaylisDescription.value,
            }),
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const diff = new Date() - startDate;
        if (diff < CREATING_PLAYLIST_MIN_MS)
          await new Promise((resolve) =>
            setTimeout(resolve, CREATING_PLAYLIST_MIN_MS - diff)
          );
        // Hide the spinner
        document
          .getElementById("creating-playlist-modal-spinner")
          .classList.add("visually-hidden");
        // Show modal close button
        document
          .getElementById("creating-playlist-modal-close")
          .classList.remove("visually-hidden");
        if (response.status !== 200) throw Error();
        const body = await response.json();
        // Change modal status text to success
        document.getElementById(
          "creating-playlist-modal-status"
        ).innerHTML = `Created playlist!\nCheck your spotify player or click <a href="${body.external_urls.spotify}">Here</a>`;
      } catch (error) {
        console.log(error);
        // Hide the spinner
        document
          .getElementById("creating-playlist-modal-spinner")
          .classList.add("visually-hidden");
        // Show modal close button
        document
          .getElementById("creating-playlist-modal-close")
          .classList.remove("visually-hidden");
        // Set background to danger / red
        document
          .getElementById("creating-playlist-modal-content")
          .classList.add("bg-danger");
        document
          .getElementById("creating-playlist-modal-status")
          .classList.add("text-white");
        // Change modal status text to error
        document.getElementById("creating-playlist-modal-status").innerHTML =
          "Error creating playlist";
      }
    }
  }

  async onAuthStateChanged(user) {
    // Skip token refresh.
    if (user && user.uid === this.lastUid) return;
    this.loadingCard.style.display = "none";
    if (user) {
      this.lastUid = user.uid;
      this.profilePic.src = user.photoURL;
      this.navbarProfileWrapper.style.display = "block";
      this.signedOutCard.style.display = "none";
      this.signedInCard.style.display = "block";
      this.destinationPlaylistForm.classList.remove("was-validated");
      await this.fetchPlaylists();
    } else {
      this.lastUid = null;
      this.signedOutCard.style.display = "block";
      this.signedInCard.style.display = "none";
    }
  }

  async fetchPlaylists() {
    document
      .getElementById("source-playlist-loading")
      .classList.remove("d-none");
    // If using local and no playlists then try and fetch
    // If not using local then fetch
    if (!this.useLocal || (this.useLocal && !this.playlists.length)) {
      const token = await firebase.auth().currentUser.getIdToken();

      const response = await fetch(`${this.baseUrl}/spotify/playlists`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status !== 200) {
        this.onSignOutButtonClick();
        return;
      }
      this.playlists = await response.json();

      if (this.useLocal)
        localStorage.setItem("playlists", JSON.stringify(this.playlists));
    }
    document.getElementById("source-playlist-loading").classList.add("d-none");
    this.createSourcePlaylistTable();
  }

  createSourcePlaylistTable() {
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
        const playlistItem = document.createElement("a");
        playlistItem.href = "#";
        playlistItem.setAttribute(
          "class",
          "list-group-item list-group-item-action list-group-item-dark"
        );
        playlistItem.setAttribute("id", playlist.id);
        const playlistImg = document.createElement("img");
        playlistImg.classList.add("playlist-avatar");
        playlistImg.src = playlist.images[0].url;
        const playlistName = document.createElement("span");
        playlistName.setAttribute("class", "playlist-name");
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
    this.profilePic.src = "";
    this.playlists = [];
    this.selectPlaylists = [];
    // Remove all playlist item from sourcePlaylist List
    while (this.sourcePlaylistList.firstChild) {
      this.sourcePlaylistList.firstChild.remove();
    }
    this.destinationPlaylistName.value = "";
    this.destinationPlaylisDescription.value = "";
    this.updateDestinationPlaylistNameCounter(0);
    this.updateDestinationPlaylistDescCounter(0);
  }
  onSourcePlaylistSelect(id, active) {
    // Add / Remove selected playlist from selectedPlaylists
    active
      ? this.selectPlaylists.push(id)
      : (this.selectPlaylists = this.selectPlaylists.filter(
          (playlistId) => playlistId !== id
        ));
    const playlistDescription = this.selectPlaylists
      .map(
        (playlistId) =>
          this.playlists.find((playlist) => playlist.id === playlistId).name
      )
      .join(" + ");
    // Update Combined Playlist Description
    if (playlistDescription.length > PLAYLIST_DESCRIPTION_MAX_LENGTH) return;
    this.destinationPlaylisDescription.value = playlistDescription;

    // Update Combined Playlist Description char counter
    this.updateDestinationPlaylistDescCounter(
      this.destinationPlaylisDescription.value.length
    );
  }
  updateDestinationPlaylistDescCounter(count) {
    this.destinationPlaylistDescCounter.innerText = `${count}/${PLAYLIST_DESCRIPTION_MAX_LENGTH}`;
  }
  updateDestinationPlaylistNameCounter(count) {
    this.destinationPlaylistNameCounter.innerText = `${count}/${PLAYLIST_NAME_MAX_LENGTH}`;
  }
}

new Main();
