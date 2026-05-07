import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config(); // Ensure env vars are loaded (safe to call multiple times)

export function initGoogleStrategy() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/api/auth/google/callback";

  if (!clientID || !clientSecret) {
    console.warn('⚠️  Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
    return;
  }

  passport.use(new GoogleStrategy({ clientID, clientSecret, callbackURL },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // Check if user exists with same email - link accounts
        const email = profile.emails?.[0]?.value;
        if (email) {
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            user.avatar = profile.photos?.[0]?.value || user.avatar;
            await user.save();
            return done(null, user);
          }
        }

        // Create new user from Google profile
        const rawName = profile.displayName || email?.split('@')[0] || 'user';
        const username = rawName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || `user${Date.now()}`;
        let finalUsername = username;
        const existingUsername = await User.findOne({ username });
        if (existingUsername) finalUsername = `${username}${Date.now().toString(36)}`;

        user = new User({
          googleId: profile.id,
          username: finalUsername,
          email: email || `${profile.id}@google.com`,
          password: Math.random().toString(36) + Math.random().toString(36),
          avatar: profile.photos?.[0]?.value || '',
          isActive: true
        });

        await user.save();
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  ));

  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  console.log('✅ Google OAuth strategy initialized');
}
