// Every path the app serves, so a link, a redirect and the route behind them cannot drift apart
export const routes = {
  today: "/",
  signIn: "/sign-in",
  setup: "/setup",
  signOut: "/sign-out",
  settings: "/settings",
  componentGallery: "/dev/ui",
} as const;
