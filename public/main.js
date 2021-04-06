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
    // const thread = document.createElement("thead");
    // const tr = document.createElement("tr");
    // const th = document.createElement("th");
    // th.innerText = "Name";
    // th.classList.add("mdl-data-table__cell--non-numeric");
    // tr.appendChild(th);
    // thread.appendChild(tr);
    const tbody = document.getElementById("playlist-list");
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
        //<tr>
        //  <td>
        //      <label class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect mdl-data-table__select" for="row[1]">
        //          <input class="mdl-checkbox__input" id="row[1]" type="checkbox">
        //      </label>
        //  </td>
        // <td class="mdl-data-table__cell--non-numeric">Ronald Macdonald</td>
        //</tr>

        // <tr>
        const tbodyTr = document.createElement("tr");
        // <td> for checkbox
        const tdCheckBox = document.createElement("td");
        tdCheckBox.classList.add("mdl-data-table__cell--non-numeric");
        // <label>
        const label = document.createElement("label");
        label.setAttribute(
          "class",
          "mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect mdl-data-table__select"
        );
        // <input>
        const input = document.createElement("input");
        input.setAttribute("class", "mdl-checkbox__input");
        input.setAttribute("type", "checkbox");
        label.appendChild(input);
        tdCheckBox.appendChild(label);

        const tdName = document.createElement("td");
        tdName.setAttribute("class", "mdl-data-table__cell--non-numeric");
        tdName.innerText = playlist.name;

        tbodyTr.append(tdCheckBox, tdName);

        componentHandler.upgradeElement(input);
        componentHandler.upgradeElement(label);
        componentHandler.upgradeElement(tdCheckBox);
        componentHandler.upgradeElement(tdName);
        componentHandler.upgradeElement(tbodyTr);
        tbody.appendChild(tbodyTr);

        // Populate playlist unordered list
        // const playlistItem = document.createElement("li");
        // playlistItem.classList.add("mdl-list__item");
        // const playlistImg = document.createElement("img");
        // playlistImg.classList.add("playlist-avatar");
        // playlistImg.src = playlist.images[0].url;
        // const playlistName = document.createElement("span");
        // playlistName.classList.add("mdl-list__item-primary-content");
        // playlistName.innerText = playlist.name;
        // playlistItem.replaceChildren(playlistImg, playlistName);
        // this.sourcePlaylistList.append(playlistItem);
      });
    this.sourcePlaylistTable.appendChild(tbody);
    this.sourcePlaylistTable.style.display = "block";
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
