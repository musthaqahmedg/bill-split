// Inside the app we store you as 'Me'.
// show(): what YOU see in the app  →  "You"
// real(): what FRIENDS see in messages and links  →  your real name from your profile
export const show = (name) => (name === 'Me' ? 'You' : name);
export const real = (name, myName) => (name === 'Me' ? myName || 'Host' : name);
