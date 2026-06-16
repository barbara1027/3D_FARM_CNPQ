import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { UsuarioRepository } from "../usuarios/usuarios.repository";
import { UsuarioService } from "../usuarios/usuarios.service";

const usuarioRepository = new UsuarioRepository();
const usuarioService = new UsuarioService(usuarioRepository);

export function configureGoogleStrategy() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3333/auth/google/callback";

  if (!clientID || !clientSecret) {
    console.warn(
      "[Google OAuth] GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não definidos. " +
      "O login com Google estará desativado."
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email =
            profile.emails?.[0]?.value ?? `${profile.id}@google.placeholder`;
          const nome = profile.displayName ?? "Usuário Google";
          const avatarUrl = profile.photos?.[0]?.value ?? null;

          const usuario = await usuarioService.upsertGoogle({
            googleId: profile.id,
            email,
            nome,
            avatarUrl,
          });

          return done(null, usuario);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // Passport exige serialize/deserialize mesmo sem sessão persistente
  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const usuario = await usuarioRepository.findById(id);
      done(null, usuario);
    } catch (err) {
      done(err);
    }
  });
}
