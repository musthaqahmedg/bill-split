import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Deletes the signed-in user's account and everything they own (App Store + Google Play rules).
// Used by "Delete my account" in the app and by the website's delete-account page.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Who is asking? (only ever deletes the caller's own account)
    const { data: { user }, error: e0 } = await admin.auth.getUser(token);
    if (e0 || !user) return json({ error: 'Not logged in' }, 401);
    const uid = user.id;
    const must = (r: { error: unknown }) => {
      if (r.error) throw r.error;
    };

    // Remove every file in a storage folder (ignore if empty)
    const wipe = async (bucket: string, folder: string) => {
      const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
      const paths = (data ?? []).map((f) => `${folder}/${f.name}`);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    };

    // 1. Photos: their profile pictures, bug screenshots, and photos in plans they host
    await wipe('avatars', uid);
    await wipe('feedback', uid);
    const { data: myParties } = await admin.from('parties').select('id').eq('created_by', uid);
    for (const p of myParties ?? []) await wipe('party-photos', p.id);
    const { data: myPhotos } = await admin.from('party_photos').select('path').eq('user_id', uid);
    const photoPaths = (myPhotos ?? []).map((p) => p.path).filter(Boolean);
    if (photoPaths.length) await admin.storage.from('party-photos').remove(photoPaths);
    must(await admin.from('party_photos').delete().eq('user_id', uid));

    // 2. Unlink them from other people's bills and table orders (keeps those records intact)
    must(await admin.from('bill_participants').update({ user_id: null }).eq('user_id', uid));
    must(await admin.from('orders').update({ placed_by: null }).eq('placed_by', uid));

    // 3. Restaurants they own (menus, tables, tabs and orders go with them)
    must(await admin.from('venues').delete().eq('owner_id', uid));

    // 4. Their own bills (items, people, claims and payments go with them)
    must(await admin.from('bills').delete().eq('created_by', uid));

    // 5. Profile, then the login itself (plans, friends, chats, notifications and the rest are removed with it)
    must(await admin.from('profiles').delete().eq('id', uid));
    must(await admin.auth.admin.deleteUser(uid));

    console.log(`delete-account: deleted ${uid}`);
    return json({ ok: true });
  } catch (e) {
    console.log('delete-account failed:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
