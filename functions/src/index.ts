import * as functions from "firebase-functions";
import * as corsModule from "cors";
const cors = corsModule({ origin: true });
import * as express from "express";
import * as crypto from "crypto";
import * as oauth2lib from "simple-oauth2";
import * as cookieParser from "cookie-parser";

const app = express();
app.use(cors);
app.use(cookieParser());

const credentials = {
  client: {
    id: functions.config().spotify.client_id,
    secret: functions.config().spotify.client_secret,
  },
  auth: {
    tokenHost: "https://accounts.spotify.com",
    tokenPath: "/api/token",
  },
};
const oauth2 = new oauth2lib.AuthorizationCode(credentials);

app.get("/auth/spotify/redirect", (req, res) => {
  // Generate a random state verification cookie.
  const state =
    (req.cookies && req.cookies.state) ||
    crypto.randomBytes(20).toString("hex");
  // Allow unsecure cookies on localhost.
  const secureCookie = false;
  console.log("state", state);
  res.cookie("state", state.toString(), {
    maxAge: 3600000,
    secure: secureCookie,
    httpOnly: true,
  });
  const scopes = "user-read-private user-read-email";
  res.redirect(
    "https://accounts.spotify.com/authorize" +
      "?response_type=code" +
      `&state=${state}` +
      "&client_id=" +
      functions.config().spotify.client_id +
      (scopes ? "&scope=" + encodeURIComponent(scopes) : "") +
      "&redirect_uri=" +
      encodeURIComponent(
        `http://localhost:5001/spotify-should-sync-merged-pla/us-central1/app/auth/spotify/callback`
      )
  );
});

app.get("/auth/spotify/callback", (req, res) => {
  console.log(req.cookies);
  // Check that we received a State Cookie.
  if (!req.cookies || !req.cookies.state) {
    return res
      .status(400)
      .send(
        "State cookie not set or expired. Maybe you took too long to authorize. Please try again."
      );
    // Check the State Cookie is equal to the state parameter.
  } else if (req.cookies.state !== req.query.state) {
    return res.status(400).send("State validation failed");
  }

  // Exchange the auth code for an access token.
  console.log(`${req.protocol}://${req.get("host")}/spotify-callback`);
  oauth2
    .getToken({
      code: req.query.code,
      redirect_uri: `http://localhost:5001/spotify-should-sync-merged-pla/us-central1/app/auth/spotify/callback`,
    })
    .then((results: unknown) => {
      console.log(results);
      res.send(results);
    });
});
exports.app = functions.https.onRequest(app);
