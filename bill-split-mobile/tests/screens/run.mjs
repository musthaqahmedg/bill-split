// 🧪 Screen tests in a real browser (free): renders the actual app/website screens with sample data,
// taps through them like a user and checks the result. Run: npm run test:screens
// Needs Google Chrome installed (uses it directly, nothing else to download).
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobile = resolve(here, '../..');
const out = join(mobile, 'node_modules/.cache/screen-tests');
mkdirSync(out, { recursive: true });

const stubs = {
  name: 'stubs',
  setup(b) {
    b.onResolve({ filter: /^react-native$/ }, () => ({ path: join(mobile, 'node_modules/react-native-web/dist/index.js') }));
    // one React for everything (the website and the app folders each have their own copy)
    b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (x) => ({ path: require.resolve(x.path, { paths: [mobile] }) }));
    b.onResolve({ filter: /^expo-haptics$|services\/profile$|supabaseBrowser$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({
      loader: 'js',
      contents: a.path === 'expo-haptics'
        ? 'export const selectionAsync=()=>{};export const impactAsync=()=>{};export const notificationAsync=()=>{};export const ImpactFeedbackStyle={};export const NotificationFeedbackType={};'
        : a.path.endsWith('supabaseBrowser')
          ? 'export const supabase = () => ({ rpc: async (n, x) => { window.__rpc.push([n, x]); return { error: null }; } });'
          : 'export const getNoAlcohol = async () => false; export const getProfile = async () => window.__profile || {}; export const saveUpi = async (u) => { window.__savedUpi.push(u); }; export const isValidUpi = (v) => /^[\\w.\\-]{2,}@[a-zA-Z]{2,}$/.test((v || "").trim());',
    }));
  },
};
const ENTRY = { items: 'items.harness.jsx', billpage: 'billpage.harness.tsx', invite: 'invite.harness.tsx', billqr: 'billqr.harness.jsx' };
for (const name of Object.keys(ENTRY)) {
  const entry = join(here, ENTRY[name]);
  await esbuild.build({
    entryPoints: [entry], bundle: true, outfile: join(out, name + '.js'), format: 'iife', jsx: 'automatic',
    loader: { '.js': 'jsx' }, nodePaths: [join(mobile, 'node_modules'), join(mobile, '../node_modules')], plugins: [stubs],
    define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true', global: 'window' }, logLevel: 'error',
  });
  writeFileSync(join(out, name + '.html'), `<!doctype html><html><head><meta name="viewport" content="width=390"><style>html,body,#root{margin:0;height:100%;background:#0E0E12}</style></head><body><div id="root"></div><script src="${name}.js"></script></body></html>`);
}
const page = (name) => pathToFileURL(join(out, name + '.html')).href;

const b = await chromium.launch({ channel: 'chrome', executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
let fails = 0;
const check = (l, c) => { if (!c) fails++; console.log((c ? '✅ ' : '❌ ') + l); };
const errors = [];
async function newPage() {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', (e) => errors.push(String(e)));
  return p;
}

console.log('\n🧾 Who had what? (app)');
{
  const p = await newPage();
  const has = async (t) => (await p.getByText(t, { exact: false }).count()) > 0;
  await p.goto(page('items'));
await p.waitForTimeout(800);

await check('title shows "What did you have?"', await has('What did'));
await check('starts with Done · next person', await has('Done · next person'));

// You: fries, pizza, beer
await p.getByText('French Fries Parmesan Garlic').click();
await p.getByText('Rei Cotta Pizza - Large').click();
await p.getByText('Kingfisher Ultra', { exact: false }).click();
await check('footer counts 3 items for you', await has('You · 3 items picked'));
await p.getByText('Done · next person').click();
await p.waitForTimeout(200);
await check('next person is Alina', await has('Alina</') || (await p.locator('text=Alina').count()) > 1);
await check('fries shows "also had this" for Alina', await has('also had this'));
await p.getByText('French Fries Parmesan Garlic').click();
await p.getByText('Coke').click();
await check('shared share shown (₹175 each)', await has('₹175 each'));
await p.getByText('Done · next person').click();
// Anuraj: not drinking → beer skipped
await p.getByText('Not drinking?').click();
await check('Anuraj marked not drinking', await has('Anuraj is not drinking'));
await check('beer shows skipped note', await has("Not drinking, so this one's skipped"));
await p.getByText('Rei Cotta Pizza - Large').click();
await p.getByText('Done · next person').click();
// Kanchan + Ram: beer
await p.getByText('Kingfisher Ultra', { exact: false }).click();
await check('"How many?" appears for a shared 3× beer', await has('How many?'));
await p.getByText('Done · next person').click();
await p.getByText('Kingfisher Ultra', { exact: false }).click();
await check('last person + all claimed → SEE THE SPLIT', await has('SEE THE SPLIT'));
await p.getByText('SEE THE SPLIT').click();
const r = await p.evaluate(() => window.__result);
await check('split result handed on', !!r);
if (r) {
  const c = r.claims;
  await check('fries = You + Alina', JSON.stringify(c[0].sort()) === JSON.stringify(['Alina', 'Me']));
  await check('pizza = You + Anuraj', JSON.stringify(c[1].sort()) === JSON.stringify(['Anuraj', 'Me']));
  await check('beer = You + Kanchan + Ram, not Anuraj', !c[2].includes('Anuraj') && ['Me', 'Kanchan', 'Ram'].every((x) => c[2].includes(x)));
  await check('coke = Alina', JSON.stringify(c[3]) === JSON.stringify(['Alina']));
  await check('Anuraj saved as not drinking', r.dry.includes('Anuraj'));
}
// tap a face to jump back
await p.getByText('Alina', { exact: true }).first().click();
await check('tapping a face switches person', await has('Alina · 2 items picked'));
  await p.close();
}

console.log('\n📲 Bill page friends open from the QR (website)');
{
  const p = await newPage();
  const has = async (t) => (await p.getByText(t, { exact: false }).count()) > 0;
  await p.goto(page('billpage')); await p.waitForTimeout(400);
check('asks "Tap your face"', await has('Tap your face'));
check('host (Me) is not a face to pick', !(await p.locator('button', { hasText: /^MeMe$/ }).count()));
// Alina has items → sees her share + pay
await p.getByRole('button', { name: /Alina/ }).click();
check('Alina sees what she owes', await has('You owe Musthaq'));
check('Pay with UPI button', await has('with UPI'));
check('Not right? Tick what you had', await has('Tick what you had'));
// Anuraj has nothing → straight to "What did Anuraj have?"
await p.getByRole('button', { name: /Anuraj/ }).click();
check('Anuraj (nothing yet) goes straight to "What did … have?"', await has('have?'));
check('shows "also had this" chips', await has('also had this'));
check('send disabled until something is ticked', await has('Tick what you had'));
await p.getByRole('button', { name: /^Coke/ }).click();
await p.getByRole('button', { name: /^Rei Cotta Pizza/ }).click();
check('button counts picks', await has('send 2 items to Musthaq'));
await p.getByText(/send 2 items/).click(); await p.waitForTimeout(200);
const rpc = await p.evaluate(() => window.__rpc);
const last = rpc.filter((x) => x[0] === 'submit_self_claims').pop();
check('sends the right items for Anuraj', !!last && last[1].p_participant === 'an' && last[1].p_items.map((x) => x.item_id).sort().join() === 'i2,i4');
check('confirms it was sent', await has('Sent to Musthaq'));
  await p.close();
}

console.log('\n💸 Plan invite page once a real bill exists (website)');
{
  const p = await newPage();
  const has = async (t) => (await p.getByText(t, { exact: false }).count()) > 0;
  await p.goto(page('invite')); await p.waitForTimeout(600);
  check('shows the bill section', await has('🧾 The bill'));
  check('says who paid and the total', await has('Gauthamnath paid it'));
  const href = await p.getByText('See my share & pay →').first().getAttribute('href');
  check('"See my share & pay" opens that bill', href === '/b/tok-1');
  await p.getByRole('button', { name: /^Alina/ }).first().click(); await p.waitForTimeout(200);
  check('a guest sees "The bill is in", not "you pay nothing"', (await has('The bill is in')) && !(await has('You pay nothing')));
  await p.goto(page('invite') + '#nobill'); await p.reload(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^Alina/ }).first().click(); await p.waitForTimeout(200);
  check('no bill yet → the treat message still shows', (await has('You pay nothing')) && !(await has('🧾 The bill')));
  await p.close();
}

console.log('\n📲 QR sheet asks for the payer\'s UPI ID (app)');
{
  const p = await newPage();
  const has = async (t) => (await p.getByText(t, { exact: false }).count()) > 0;
  await p.goto(page('billqr')); await p.waitForTimeout(600);
  check('asks "Where should friends pay you?"', await has('Where should friends pay you?'));
  await p.getByPlaceholder('name@okicici').fill('gautham@okhdfc');
  await p.getByText('Save', { exact: true }).click(); await p.waitForTimeout(300);
  const saved = await p.evaluate(() => window.__savedUpi);
  check('saves the UPI ID', saved[0] === 'gautham@okhdfc');
  check('then shows where the money goes', await has('Money goes straight to your UPI (gautham@okhdfc)'));
  check('the ask disappears once saved', !(await has('Where should friends pay you?')));
  await p.close();
}

await b.close();
if (errors.length) { console.log('\n❌ Page errors:', errors); fails++; }
console.log(fails ? `\n${fails} check(s) failed` : '\nAll screen checks passed ✅');
process.exit(fails ? 1 : 0);
